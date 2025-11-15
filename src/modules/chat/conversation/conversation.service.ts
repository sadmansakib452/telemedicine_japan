import {
  Injectable,
  HttpException,
  HttpStatus,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { PrismaService } from '../../../prisma/prisma.service';
import { PrismaClient } from '@prisma/client';
import appConfig from '../../../config/app.config';
import { SojebStorage } from '../../../common/lib/Disk/SojebStorage';
import { DateHelper } from '../../../common/helper/date.helper';
import { MessageGateway } from '../message/message.gateway';
import { BroadcastService } from '../broadcast/broadcast.service';

/**
 * Conversation Service
 * Handles all business logic related to conversations
 * - Creates conversations between users
 * - Integrates with broadcasts (when a doctor responds to a patient's broadcast)
 * - Ensures only one doctor can respond to a broadcast
 */
@Injectable()
export class ConversationService {
  constructor(
    private prisma: PrismaService,
    private readonly messageGateway: MessageGateway,
    @Inject(forwardRef(() => BroadcastService))
    private readonly broadcastService: BroadcastService,
  ) {}

  /**
   * Create a new conversation
   * If broadcast_id is provided, this creates a conversation from a broadcast
   * Ensures only one doctor can respond to a broadcast
   * @param createConversationDto - The conversation data
   * @returns Created conversation
   */
  async create(createConversationDto: CreateConversationDto) {
    try {
      const data: any = {};

      if (createConversationDto.creator_id) {
        data.creator_id = createConversationDto.creator_id;
      }
      if (createConversationDto.participant_id) {
        data.participant_id = createConversationDto.participant_id;
      }

      // Handle broadcast integration
      if (createConversationDto.broadcast_id) {
        // Validate broadcast exists and is open
        const broadcast = await this.prisma.broadcast.findUnique({
          where: { id: createConversationDto.broadcast_id },
          select: {
            id: true,
            status: true,
            patient_id: true,
            assisted_by: true,
            conversation_id: true,
          },
        });

        if (!broadcast) {
          throw new HttpException('Broadcast not found', HttpStatus.NOT_FOUND);
        }

        // Check if broadcast is already assisted
        if (broadcast.status !== 'open') {
          throw new HttpException(
            'This broadcast has already been assisted by another doctor',
            HttpStatus.CONFLICT,
          );
        }

        // Check if broadcast already has a conversation
        if (broadcast.conversation_id) {
          // Return the existing conversation
          const existingConversation =
            await this.prisma.conversation.findUnique({
              where: { id: broadcast.conversation_id },
              select: {
                id: true,
                creator_id: true,
                participant_id: true,
                created_at: true,
                updated_at: true,
                broadcast_id: true,
                type: true,
                status: true,
                creator: {
                  select: {
                    id: true,
                    name: true,
                    avatar: true,
                    type: true,
                  },
                },
                participant: {
                  select: {
                    id: true,
                    name: true,
                    avatar: true,
                    type: true,
                  },
                },
                messages: {
                  orderBy: {
                    created_at: 'desc',
                  },
                  take: 1,
                  select: {
                    id: true,
                    message: true,
                    created_at: true,
                  },
                },
              },
            });

          if (existingConversation) {
            // Add avatar URLs
            if (existingConversation.creator?.avatar) {
              existingConversation.creator['avatar_url'] = SojebStorage.url(
                appConfig().storageUrl.avatar +
                  existingConversation.creator.avatar,
              );
            }
            if (existingConversation.participant?.avatar) {
              existingConversation.participant['avatar_url'] = SojebStorage.url(
                appConfig().storageUrl.avatar +
                  existingConversation.participant.avatar,
              );
            }

            return {
              success: false,
              message: 'Conversation already exists for this broadcast',
              data: existingConversation,
            };
          }
        }

        // Validate that participant (doctor) is responding to patient's broadcast
        if (
          broadcast.patient_id !== data.creator_id &&
          broadcast.patient_id !== data.participant_id
        ) {
          throw new HttpException(
            'The broadcast patient must be one of the conversation participants',
            HttpStatus.BAD_REQUEST,
          );
        }

        // Set conversation type and broadcast link
        data.broadcast_id = createConversationDto.broadcast_id;
        data.type = createConversationDto.type || 'patient_doctor';
        data.status = 'open';

        // Set assisted_by to the doctor who is responding
        // The doctor is the one who is NOT the patient
        if (broadcast.patient_id === data.creator_id) {
          data.assisted_by = data.participant_id; // Doctor is participant
        } else {
          data.assisted_by = data.creator_id; // Doctor is creator
        }
      } else {
        // Regular conversation (not from broadcast)
        data.type = createConversationDto.type || 'patient_doctor';
        data.status = 'open';
      }

      // Check if conversation already exists (without broadcast)
      if (!createConversationDto.broadcast_id) {
        const existingConversation = await this.prisma.conversation.findFirst({
          select: {
            id: true,
            creator_id: true,
            participant_id: true,
            created_at: true,
            updated_at: true,
            creator: {
              select: {
                id: true,
                name: true,
                avatar: true,
                type: true,
              },
            },
            participant: {
              select: {
                id: true,
                name: true,
                avatar: true,
                type: true,
              },
            },
            messages: {
              orderBy: {
                created_at: 'desc',
              },
              take: 1,
              select: {
                id: true,
                message: true,
                created_at: true,
              },
            },
          },
          where: {
            creator_id: data.creator_id,
            participant_id: data.participant_id,
            broadcast_id: null, // Only check non-broadcast conversations
          },
        });

        if (existingConversation) {
          // Add avatar URLs
          if (existingConversation.creator?.avatar) {
            existingConversation.creator['avatar_url'] = SojebStorage.url(
              appConfig().storageUrl.avatar +
                existingConversation.creator.avatar,
            );
          }
          if (existingConversation.participant?.avatar) {
            existingConversation.participant['avatar_url'] = SojebStorage.url(
              appConfig().storageUrl.avatar +
                existingConversation.participant.avatar,
            );
          }

          return {
            success: false,
            message: 'Conversation already exists',
            data: existingConversation,
          };
        }
      }

      // Create the conversation
      const conversation = await this.prisma.conversation.create({
        select: {
          id: true,
          creator_id: true,
          participant_id: true,
          broadcast_id: true,
          type: true,
          status: true,
          assisted_by: true,
          created_at: true,
          updated_at: true,
          creator: {
            select: {
              id: true,
              name: true,
              avatar: true,
              type: true,
            },
          },
          participant: {
            select: {
              id: true,
              name: true,
              avatar: true,
              type: true,
            },
          },
          messages: {
            orderBy: {
              created_at: 'desc',
            },
            take: 1,
            select: {
              id: true,
              message: true,
              created_at: true,
            },
          },
        },
        data: {
          ...data,
        },
      });

      // Update broadcast status to "assisted" and link conversation
      if (createConversationDto.broadcast_id) {
        try {
          await this.broadcastService.update(
            createConversationDto.broadcast_id,
            {
              status: 'assisted',
              assisted_by: data.assisted_by,
              conversation_id: conversation.id,
            },
          );
        } catch (broadcastError) {
          // Log error but don't fail the conversation creation
          console.error('Failed to update broadcast:', broadcastError);
        }
      }

      // Add image URLs
      if (conversation.creator?.avatar) {
        conversation.creator['avatar_url'] = SojebStorage.url(
          appConfig().storageUrl.avatar + conversation.creator.avatar,
        );
      }
      if (conversation.participant?.avatar) {
        conversation.participant['avatar_url'] = SojebStorage.url(
          appConfig().storageUrl.avatar + conversation.participant.avatar,
        );
      }

      // Trigger socket event
      if (data.creator_id) {
        this.messageGateway.server.to(data.creator_id).emit('conversation', {
          from: data.creator_id,
          data: conversation,
        });
      }
      if (data.participant_id) {
        this.messageGateway.server
          .to(data.participant_id)
          .emit('conversation', {
            from: data.participant_id,
            data: conversation,
          });
      }

      // Notify all doctors about the broadcast update
      if (createConversationDto.broadcast_id) {
        this.messageGateway.server.emit('broadcast_assisted', {
          broadcast_id: createConversationDto.broadcast_id,
          conversation: conversation,
        });
      }

      return {
        success: true,
        message: 'Conversation created successfully',
        data: conversation,
      };
    } catch (error) {
      // Handle known errors
      if (error instanceof HttpException) {
        throw error;
      }

      // Handle database errors
      if (error.code === 'P2002') {
        throw new HttpException(
          'A conversation with this information already exists',
          HttpStatus.CONFLICT,
        );
      }

      // Handle other errors
      throw new HttpException(
        error.message || 'Failed to create conversation',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Find all conversations for a user
   * Returns all conversations where the user is creator or participant
   * @param userId - The ID of the authenticated user
   * @returns List of conversations for the user
   */
  async findAll(userId: string) {
    try {
      // Validate user ID is provided
      if (!userId) {
        throw new HttpException('User ID is required', HttpStatus.BAD_REQUEST);
      }

      // Fetch conversations where user is creator OR participant
      const conversations = await this.prisma.conversation.findMany({
        where: {
          deleted_at: null, // Only non-deleted conversations
          OR: [
            { creator_id: userId }, // User is creator
            { participant_id: userId }, // User is participant
          ],
        },
        orderBy: {
          updated_at: 'desc', // Most recently updated first
        },
        select: {
          id: true,
          creator_id: true,
          participant_id: true,
          broadcast_id: true,
          type: true,
          status: true,
          assisted_by: true,
          created_at: true,
          updated_at: true,
          creator: {
            select: {
              id: true,
              name: true,
              avatar: true,
              type: true,
            },
          },
          participant: {
            select: {
              id: true,
              name: true,
              avatar: true,
              type: true,
            },
          },
          messages: {
            orderBy: {
              created_at: 'desc',
            },
            take: 1, // Get last message for preview
            select: {
              id: true,
              message: true,
              message_type: true,
              created_at: true,
            },
          },
        },
      });

      // Add avatar URLs
      for (const conversation of conversations) {
        if (conversation.creator?.avatar) {
          conversation.creator['avatar_url'] = SojebStorage.url(
            appConfig().storageUrl.avatar + conversation.creator.avatar,
          );
        }
        if (conversation.participant?.avatar) {
          conversation.participant['avatar_url'] = SojebStorage.url(
            appConfig().storageUrl.avatar + conversation.participant.avatar,
          );
        }
      }

      return {
        success: true,
        data: conversations,
        count: conversations.length,
      };
    } catch (error) {
      // Handle known errors
      if (error instanceof HttpException) {
        throw error;
      }

      // Handle other errors
      throw new HttpException(
        error.message || 'Failed to fetch conversations',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Find a single conversation by ID
   * Returns conversation with broadcast information if applicable
   * Verifies that the user is authorized to access this conversation
   * @param id - The ID of the conversation
   * @param userId - The ID of the authenticated user
   * @returns The conversation
   */
  async findOne(id: string, userId: string) {
    try {
      // Validate user ID is provided
      if (!userId) {
        throw new HttpException('User ID is required', HttpStatus.BAD_REQUEST);
      }

      // Fetch conversation by ID
      const conversation = await this.prisma.conversation.findUnique({
        where: { id },
        select: {
          id: true,
          creator_id: true,
          participant_id: true,
          broadcast_id: true,
          type: true,
          status: true,
          assisted_by: true,
          created_at: true,
          updated_at: true,
          deleted_at: true,
          creator: {
            select: {
              id: true,
              name: true,
              avatar: true,
              type: true,
            },
          },
          participant: {
            select: {
              id: true,
              name: true,
              avatar: true,
              type: true,
            },
          },
          messages: {
            orderBy: {
              created_at: 'desc',
            },
            take: 10,
            select: {
              id: true,
              message: true,
              message_type: true,
              created_at: true,
            },
          },
        },
      });

      // Check if conversation exists
      if (!conversation) {
        throw new HttpException('Conversation not found', HttpStatus.NOT_FOUND);
      }

      // Check if conversation is deleted
      if (conversation.deleted_at) {
        throw new HttpException('Conversation not found', HttpStatus.NOT_FOUND);
      }

      // Verify user is authorized to access this conversation
      // User must be either creator or participant
      if (
        conversation.creator_id !== userId &&
        conversation.participant_id !== userId
      ) {
        throw new HttpException(
          'You are not authorized to access this conversation',
          HttpStatus.FORBIDDEN,
        );
      }

      // Add avatar URLs
      if (conversation.creator?.avatar) {
        conversation.creator['avatar_url'] = SojebStorage.url(
          appConfig().storageUrl.avatar + conversation.creator.avatar,
        );
      }
      if (conversation.participant?.avatar) {
        conversation.participant['avatar_url'] = SojebStorage.url(
          appConfig().storageUrl.avatar + conversation.participant.avatar,
        );
      }

      // Remove deleted_at from response (not needed in response)
      const { deleted_at, ...conversationData } = conversation;

      return {
        success: true,
        data: conversationData,
      };
    } catch (error) {
      // Handle known errors
      if (error instanceof HttpException) {
        throw error;
      }

      // Handle database errors
      if (error.code === 'P2025') {
        throw new HttpException('Conversation not found', HttpStatus.NOT_FOUND);
      }

      // Handle other errors
      throw new HttpException(
        error.message || 'Failed to fetch conversation',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Create a conversation from a broadcast (Doctor responding to patient)
   * This method ensures only one doctor can respond to a broadcast
   * @param broadcastId - The ID of the broadcast
   * @param doctorId - The ID of the doctor responding
   * @returns Created conversation
   */
  async createFromBroadcast(
    broadcastId: string,
    doctorId: string,
  ): Promise<any> {
    try {
      // Validate broadcast exists and is open
      const broadcast = await this.prisma.broadcast.findUnique({
        where: { id: broadcastId },
        select: {
          id: true,
          status: true,
          patient_id: true,
          assisted_by: true,
          conversation_id: true,
        },
      });

      if (!broadcast) {
        throw new HttpException('Broadcast not found', HttpStatus.NOT_FOUND);
      }

      // Check if broadcast is already assisted
      if (broadcast.status !== 'open') {
        throw new HttpException(
          'This broadcast has already been assisted by another doctor',
          HttpStatus.CONFLICT,
        );
      }

      // Check if broadcast already has a conversation
      if (broadcast.conversation_id) {
        // Return the existing conversation
        // Pass doctorId for authorization check (doctor should be participant)
        const existingConversation = await this.findOne(
          broadcast.conversation_id,
          doctorId,
        );
        return {
          success: false,
          message: 'Conversation already exists for this broadcast',
          data: existingConversation.data,
        };
      }

      // Validate that the user is a doctor
      const doctor = await this.prisma.user.findUnique({
        where: { id: doctorId },
        select: {
          id: true,
          type: true,
          approved_at: true,
        },
      });

      if (!doctor) {
        throw new HttpException('Doctor not found', HttpStatus.NOT_FOUND);
      }

      if (doctor.type !== 'doctor') {
        throw new HttpException(
          'Only doctors can respond to broadcasts',
          HttpStatus.FORBIDDEN,
        );
      }

      if (!doctor.approved_at) {
        throw new HttpException(
          'Doctor account is not verified. Please wait for admin approval.',
          HttpStatus.FORBIDDEN,
        );
      }

      // Validate that the patient exists
      const patient = await this.prisma.user.findUnique({
        where: { id: broadcast.patient_id },
        select: {
          id: true,
          type: true,
        },
      });

      if (!patient) {
        throw new HttpException('Patient not found', HttpStatus.NOT_FOUND);
      }

      // Create conversation from broadcast
      // Patient is creator, Doctor is participant
      const createConversationDto: CreateConversationDto = {
        creator_id: broadcast.patient_id,
        participant_id: doctorId,
        broadcast_id: broadcastId,
        type: 'patient_doctor',
      };

      return await this.create(createConversationDto);
    } catch (error) {
      // Handle known errors
      if (error instanceof HttpException) {
        throw error;
      }

      // Handle other errors
      throw new HttpException(
        error.message || 'Failed to create conversation from broadcast',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async update(id: string, updateConversationDto: UpdateConversationDto) {
    try {
      const data = {};
      if (updateConversationDto.creator_id) {
        data['creator_id'] = updateConversationDto.creator_id;
      }
      if (updateConversationDto.participant_id) {
        data['participant_id'] = updateConversationDto.participant_id;
      }

      await this.prisma.conversation.update({
        where: { id },
        data: {
          ...data,
          updated_at: DateHelper.now(),
        },
      });

      return {
        success: true,
        message: 'Conversation updated successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async remove(id: string) {
    try {
      await this.prisma.conversation.delete({
        where: { id },
      });

      return {
        success: true,
        message: 'Conversation deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}
