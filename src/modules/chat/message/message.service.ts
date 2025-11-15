import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { MessageStatus } from '@prisma/client';
import appConfig from '../../../config/app.config';
import { CreateMessageDto } from './dto/create-message.dto';
import { PrismaService } from '../../../prisma/prisma.service';
import { ChatRepository } from '../../../common/repository/chat/chat.repository';
import { SojebStorage } from '../../../common/lib/Disk/SojebStorage';
import { DateHelper } from '../../../common/helper/date.helper';
import { MessageGateway } from './message.gateway';
import { UserRepository } from '../../../common/repository/user/user.repository';
import { Role } from '../../../common/guard/role/role.enum';

/**
 * Message Service
 * Handles all business logic related to messages
 * - Creates text messages and prescription messages
 * - Validates that only doctors can create prescriptions
 * - Manages message status and delivery
 */
@Injectable()
export class MessageService {
  constructor(
    private prisma: PrismaService,
    private readonly messageGateway: MessageGateway,
  ) {}

  /**
   * Create a new message
   * Supports both text messages and prescription messages
   * Only doctors can create prescription messages
   * @param user_id - The ID of the message sender
   * @param createMessageDto - The message data
   * @returns Created message
   */
  async create(user_id: string, createMessageDto: CreateMessageDto) {
    try {
      // Validate sender exists
      const sender = await this.prisma.user.findUnique({
        where: { id: user_id },
        select: {
          id: true,
          type: true,
          approved_at: true,
        },
      });

      if (!sender) {
        throw new HttpException('Sender not found', HttpStatus.NOT_FOUND);
      }

      // Validate message type and permissions
      const messageType = createMessageDto.message_type || 'text';

      // Only doctors can create prescription messages
      if (messageType === 'prescription') {
        if (sender.type !== 'doctor') {
          throw new HttpException(
            'Only doctors can create prescription messages',
            HttpStatus.FORBIDDEN,
          );
        }

        if (!sender.approved_at) {
          throw new HttpException(
            'Doctor account is not verified. Please wait for admin approval.',
            HttpStatus.FORBIDDEN,
          );
        }

        // Validate prescription fields
        if (!createMessageDto.medicine_details) {
          throw new HttpException(
            'Medicine details are required for prescription messages',
            HttpStatus.BAD_REQUEST,
          );
        }

        if (!createMessageDto.patient_name) {
          throw new HttpException(
            'Patient name is required for prescription messages',
            HttpStatus.BAD_REQUEST,
          );
        }
      } else {
        // Text messages require message content
        if (!createMessageDto.message) {
          throw new HttpException(
            'Message content is required for text messages',
            HttpStatus.BAD_REQUEST,
          );
        }
      }

      // Check if conversation exists
      const conversation = await this.prisma.conversation.findFirst({
        where: {
          id: createMessageDto.conversation_id,
          deleted_at: null, // Only non-deleted conversations
        },
        select: {
          id: true,
          creator_id: true,
          participant_id: true,
          type: true,
        },
      });

      if (!conversation) {
        throw new HttpException('Conversation not found', HttpStatus.NOT_FOUND);
      }

      // Validate that sender is part of the conversation
      if (
        conversation.creator_id !== user_id &&
        conversation.participant_id !== user_id
      ) {
        throw new HttpException(
          'You are not authorized to send messages in this conversation',
          HttpStatus.FORBIDDEN,
        );
      }

      // Check if receiver exists
      const receiver = await this.prisma.user.findFirst({
        where: {
          id: createMessageDto.receiver_id,
          deleted_at: null, // Only non-deleted users
        },
        select: {
          id: true,
          type: true,
        },
      });

      if (!receiver) {
        throw new HttpException('Receiver not found', HttpStatus.NOT_FOUND);
      }

      // Validate receiver is part of the conversation
      if (
        conversation.creator_id !== createMessageDto.receiver_id &&
        conversation.participant_id !== createMessageDto.receiver_id
      ) {
        throw new HttpException(
          'Receiver must be part of the conversation',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Prepare message data
      const data: any = {
        conversation_id: createMessageDto.conversation_id,
        receiver_id: createMessageDto.receiver_id,
        sender_id: user_id,
        status: MessageStatus.SENT,
        message_type: messageType,
      };

      // Add message content based on type
      if (messageType === 'prescription') {
        data.medicine_details = createMessageDto.medicine_details;
        data.patient_name = createMessageDto.patient_name;
        // For prescription messages, we can optionally add a message text
        data.message = createMessageDto.message || 'Prescription';
      } else {
        data.message = createMessageDto.message;
      }

      // Create the message
      const message = await this.prisma.message.create({
        data: data,
        select: {
          id: true,
          message: true,
          message_type: true,
          medicine_details: true,
          patient_name: true,
          sender_id: true,
          receiver_id: true,
          conversation_id: true,
          status: true,
          created_at: true,
          updated_at: true,
          sender: {
            select: {
              id: true,
              name: true,
              avatar: true,
              type: true,
            },
          },
          receiver: {
            select: {
              id: true,
              name: true,
              avatar: true,
              type: true,
            },
          },
        },
      });

      // Update conversation updated_at
      await this.prisma.conversation.update({
        where: {
          id: createMessageDto.conversation_id,
        },
        data: {
          updated_at: DateHelper.now(),
        },
      });

      // Add avatar URLs
      if (message.sender?.avatar) {
        message.sender['avatar_url'] = SojebStorage.url(
          appConfig().storageUrl.avatar + message.sender.avatar,
        );
      }
      if (message.receiver?.avatar) {
        message.receiver['avatar_url'] = SojebStorage.url(
          appConfig().storageUrl.avatar + message.receiver.avatar,
        );
      }

      // Emit WebSocket event for real-time message delivery
      this.messageGateway.server
        .to(createMessageDto.conversation_id)
        .emit('message', {
          from: user_id,
          data: message,
        });

      // Emit to receiver's personal room if connected
      const receiverSocketId = this.messageGateway.clients.get(
        createMessageDto.receiver_id,
      );
      if (receiverSocketId) {
        this.messageGateway.server.to(receiverSocketId).emit('message', {
          from: user_id,
          data: message,
        });
      }

      // If this is a prescription message, distribute it to all shop owners
      if (messageType === 'prescription') {
        try {
          await this.distributePrescriptionToShopOwners(
            user_id,
            message,
            createMessageDto,
          );
        } catch (prescriptionError) {
          // Log error but don't fail the main message creation
          console.error(
            'Failed to distribute prescription to shop owners:',
            prescriptionError,
          );
        }
      }

      return {
        success: true,
        data: message,
        message: 'Message sent successfully',
      };
    } catch (error) {
      // Handle known errors
      if (error instanceof HttpException) {
        throw error;
      }

      // Handle database errors
      if (error.code === 'P2002') {
        throw new HttpException(
          'A message with this information already exists',
          HttpStatus.CONFLICT,
        );
      }

      // Handle other errors
      throw new HttpException(
        error.message || 'Failed to create message',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findAll({
    user_id,
    conversation_id,
    limit = 20,
    cursor,
  }: {
    user_id: string;
    conversation_id: string;
    limit?: number;
    cursor?: string;
  }) {
    try {
      const userDetails = await UserRepository.getUserDetails(user_id);

      const where_condition = {
        AND: [{ id: conversation_id }],
      };

      if (userDetails.type != Role.ADMIN) {
        where_condition['OR'] = [
          { creator_id: user_id },
          { participant_id: user_id },
        ];
      }

      const conversation = await this.prisma.conversation.findFirst({
        where: {
          ...where_condition,
        },
      });

      if (!conversation) {
        return {
          success: false,
          message: 'Conversation not found',
        };
      }

      const paginationData = {};
      if (limit) {
        paginationData['take'] = limit;
      }
      if (cursor) {
        paginationData['cursor'] = cursor ? { id: cursor } : undefined;
      }

      const messages = await this.prisma.message.findMany({
        ...paginationData,
        where: {
          conversation_id: conversation_id,
          deleted_at: null, // Only non-deleted messages
        },
        orderBy: {
          created_at: 'asc',
        },
        select: {
          id: true,
          message: true,
          message_type: true,
          medicine_details: true,
          patient_name: true,
          created_at: true,
          updated_at: true,
          status: true,
          sender: {
            select: {
              id: true,
              name: true,
              avatar: true,
              type: true,
            },
          },
          receiver: {
            select: {
              id: true,
              name: true,
              avatar: true,
              type: true,
            },
          },
          attachment: {
            select: {
              id: true,
              name: true,
              type: true,
              size: true,
              file: true,
            },
          },
        },
      });

      // add attachment url
      for (const message of messages) {
        if (message.attachment) {
          message.attachment['file_url'] = SojebStorage.url(
            appConfig().storageUrl.attachment + message.attachment.file,
          );
        }
      }

      // add image url
      for (const message of messages) {
        if (message.sender && message.sender.avatar) {
          message.sender['avatar_url'] = SojebStorage.url(
            appConfig().storageUrl.avatar + message.sender.avatar,
          );
        }
        if (message.receiver && message.receiver.avatar) {
          message.receiver['avatar_url'] = SojebStorage.url(
            appConfig().storageUrl.avatar + message.receiver.avatar,
          );
        }
      }

      return {
        success: true,
        data: messages,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * Find a single message by ID
   * Returns message with prescription data if applicable
   * Verifies that the user is authorized to access this message
   * @param messageId - The ID of the message
   * @param userId - The ID of the authenticated user
   * @returns The message
   */
  async findOne(messageId: string, userId: string) {
    try {
      // Validate user ID is provided
      if (!userId) {
        throw new HttpException('User ID is required', HttpStatus.BAD_REQUEST);
      }

      // Validate message ID is provided
      if (!messageId) {
        throw new HttpException(
          'Message ID is required',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Get user details for admin check
      const userDetails = await UserRepository.getUserDetails(userId);

      // Find message by ID
      const message = await this.prisma.message.findFirst({
        where: {
          id: messageId,
          deleted_at: null, // Only non-deleted messages
        },
        select: {
          id: true,
          message: true,
          message_type: true,
          medicine_details: true,
          patient_name: true,
          sender_id: true,
          receiver_id: true,
          conversation_id: true,
          status: true,
          created_at: true,
          updated_at: true,
          sender: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
              type: true,
            },
          },
          receiver: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
              type: true,
            },
          },
          conversation: {
            select: {
              id: true,
              type: true,
              status: true,
              creator_id: true,
              participant_id: true,
            },
          },
          attachment: {
            select: {
              id: true,
              name: true,
              type: true,
              size: true,
              file: true,
            },
          },
        },
      });

      // Check if message exists
      if (!message) {
        throw new HttpException('Message not found', HttpStatus.NOT_FOUND);
      }

      // Check authorization
      // Admin can access any message
      if (userDetails.type === Role.ADMIN) {
        // Authorized - continue
      } else {
        // User must be sender, receiver, or conversation participant
        const isSender = message.sender_id === userId;
        const isReceiver = message.receiver_id === userId;
        const isConversationCreator =
          message.conversation?.creator_id === userId;
        const isConversationParticipant =
          message.conversation?.participant_id === userId;

        if (
          !isSender &&
          !isReceiver &&
          !isConversationCreator &&
          !isConversationParticipant
        ) {
          throw new HttpException(
            'You are not authorized to access this message',
            HttpStatus.FORBIDDEN,
          );
        }
      }

      // Add avatar URLs
      if (message.sender?.avatar) {
        message.sender['avatar_url'] = SojebStorage.url(
          appConfig().storageUrl.avatar + message.sender.avatar,
        );
      }
      if (message.receiver?.avatar) {
        message.receiver['avatar_url'] = SojebStorage.url(
          appConfig().storageUrl.avatar + message.receiver.avatar,
        );
      }

      // Add attachment URL if exists
      if (message.attachment?.file) {
        message.attachment['file_url'] = SojebStorage.url(
          appConfig().storageUrl.attachment + message.attachment.file,
        );
      }

      // Remove conversation creator/participant IDs from response (not needed in response)
      if (message.conversation) {
        const { creator_id, participant_id, ...conversationData } =
          message.conversation;
        message.conversation = conversationData as any;
      }

      return {
        success: true,
        data: message,
      };
    } catch (error) {
      // Handle known errors
      if (error instanceof HttpException) {
        throw error;
      }

      // Handle other errors
      throw new HttpException(
        error.message || 'Failed to fetch message',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async updateMessageStatus(message_id: string, status: MessageStatus) {
    return await ChatRepository.updateMessageStatus(message_id, status);
  }

  async readMessage(message_id: string) {
    return await ChatRepository.updateMessageStatus(
      message_id,
      MessageStatus.READ,
    );
  }

  async updateUserStatus(user_id: string, status: string) {
    return await ChatRepository.updateUserStatus(user_id, status);
  }

  /**
   * Distribute prescription to all shop owners
   * Creates or reuses doctor-shop_owner conversations for each shop owner
   * Sends prescription message to each shop owner
   * @param doctorId - The ID of the doctor who created the prescription
   * @param prescriptionMessage - The prescription message created in patient-doctor conversation
   * @param createMessageDto - The original message DTO
   */
  private async distributePrescriptionToShopOwners(
    doctorId: string,
    prescriptionMessage: any,
    createMessageDto: CreateMessageDto,
  ): Promise<void> {
    try {
      // Get all verified shop owners
      const shopOwners = await this.prisma.user.findMany({
        where: {
          type: 'shop_owner',
          approved_at: {
            not: null, // Only verified shop owners
          },
          deleted_at: null, // Only active shop owners
        },
        select: {
          id: true,
          name: true,
          email: true,
        },
      });

      if (shopOwners.length === 0) {
        console.log('No verified shop owners found to distribute prescription');
        return;
      }

      // Validate doctor exists
      const doctor = await this.prisma.user.findUnique({
        where: { id: doctorId },
        select: {
          id: true,
          name: true,
          type: true,
        },
      });

      if (!doctor || doctor.type !== 'doctor') {
        console.error('Doctor not found or invalid type');
        return;
      }

      // Distribute prescription to each shop owner
      for (const shopOwner of shopOwners) {
        try {
          // Find or create doctor-shop_owner conversation
          let doctorShopConversation = await this.prisma.conversation.findFirst(
            {
              where: {
                type: 'doctor_shop_owner',
                OR: [
                  {
                    creator_id: doctorId,
                    participant_id: shopOwner.id,
                  },
                  {
                    creator_id: shopOwner.id,
                    participant_id: doctorId,
                  },
                ],
                deleted_at: null,
              },
              select: {
                id: true,
                creator_id: true,
                participant_id: true,
              },
            },
          );

          // Create conversation if it doesn't exist
          if (!doctorShopConversation) {
            doctorShopConversation = await this.prisma.conversation.create({
              data: {
                creator_id: doctorId, // Doctor is creator
                participant_id: shopOwner.id, // Shop owner is participant
                type: 'doctor_shop_owner',
                status: 'open',
              },
              select: {
                id: true,
                creator_id: true,
                participant_id: true,
              },
            });

            // Notify shop owner about new conversation via WebSocket
            const shopOwnerSocketId = this.messageGateway.clients.get(
              shopOwner.id,
            );
            if (shopOwnerSocketId) {
              this.messageGateway.server
                .to(shopOwnerSocketId)
                .emit('new_conversation', {
                  conversation: doctorShopConversation,
                });
            }
          }

          // Create prescription message in doctor-shop_owner conversation
          const prescriptionForShopOwner = await this.prisma.message.create({
            data: {
              conversation_id: doctorShopConversation.id,
              sender_id: doctorId,
              receiver_id: shopOwner.id,
              message: prescriptionMessage.message || 'Prescription',
              message_type: 'prescription',
              medicine_details: prescriptionMessage.medicine_details,
              patient_name: prescriptionMessage.patient_name,
              status: MessageStatus.SENT,
            },
            select: {
              id: true,
              message: true,
              message_type: true,
              medicine_details: true,
              patient_name: true,
              sender_id: true,
              receiver_id: true,
              conversation_id: true,
              status: true,
              created_at: true,
              sender: {
                select: {
                  id: true,
                  name: true,
                  avatar: true,
                },
              },
              receiver: {
                select: {
                  id: true,
                  name: true,
                  avatar: true,
                },
              },
            },
          });

          // Update conversation updated_at
          await this.prisma.conversation.update({
            where: {
              id: doctorShopConversation.id,
            },
            data: {
              updated_at: DateHelper.now(),
            },
          });

          // Add avatar URLs
          if (prescriptionForShopOwner.sender?.avatar) {
            prescriptionForShopOwner.sender['avatar_url'] = SojebStorage.url(
              appConfig().storageUrl.avatar +
                prescriptionForShopOwner.sender.avatar,
            );
          }
          if (prescriptionForShopOwner.receiver?.avatar) {
            prescriptionForShopOwner.receiver['avatar_url'] = SojebStorage.url(
              appConfig().storageUrl.avatar +
                prescriptionForShopOwner.receiver.avatar,
            );
          }

          // Emit WebSocket event to shop owner
          this.messageGateway.server
            .to(doctorShopConversation.id)
            .emit('message', {
              from: doctorId,
              data: prescriptionForShopOwner,
            });

          // Emit to shop owner's personal room if connected
          const shopOwnerSocketId = this.messageGateway.clients.get(
            shopOwner.id,
          );
          if (shopOwnerSocketId) {
            this.messageGateway.server.to(shopOwnerSocketId).emit('message', {
              from: doctorId,
              data: prescriptionForShopOwner,
            });
          }

          // Emit prescription notification event
          this.messageGateway.server.to(shopOwner.id).emit('new_prescription', {
            prescription: prescriptionForShopOwner,
            doctor: {
              id: doctor.id,
              name: doctor.name,
            },
          });
        } catch (shopOwnerError) {
          // Log error for this shop owner but continue with others
          console.error(
            `Failed to distribute prescription to shop owner ${shopOwner.id}:`,
            shopOwnerError,
          );
        }
      }

      console.log(
        `Prescription distributed to ${shopOwners.length} shop owner(s)`,
      );
    } catch (error) {
      console.error('Error distributing prescription to shop owners:', error);
      throw error;
    }
  }
}
