import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { SojebStorage } from '../../../common/lib/Disk/SojebStorage';
import appConfig from '../../../config/app.config';
import { DateHelper } from '../../../common/helper/date.helper';

/**
 * Shop Owner Service
 * Handles all business logic related to shop owners
 * - Shop owners can view all prescriptions they've received
 * - Shop owners can view their conversations with doctors
 */
@Injectable()
export class ShopOwnerService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get all prescriptions for a shop owner
   * Returns all prescription messages received by the shop owner
   * @param shopOwnerId - The ID of the shop owner
   * @param limit - Maximum number of prescriptions to return
   * @param cursor - Cursor for pagination
   * @returns List of prescriptions
   */
  async findAllPrescriptions(
    shopOwnerId: string,
    limit: number = 20,
    cursor?: string,
  ): Promise<any> {
    try {
      // Validate shop owner exists
      const shopOwner = await this.prisma.user.findUnique({
        where: { id: shopOwnerId },
        select: {
          id: true,
          type: true,
          approved_at: true,
        },
      });

      if (!shopOwner) {
        throw new HttpException('Shop owner not found', HttpStatus.NOT_FOUND);
      }

      if (shopOwner.type !== 'shop_owner') {
        throw new HttpException(
          'Only shop owners can view prescriptions',
          HttpStatus.FORBIDDEN,
        );
      }

      // Get all prescription messages received by this shop owner
      // Note: Using explicit query structure to ensure TypeScript infers types correctly
      const prescriptions = await this.prisma.message.findMany({
        where: {
          receiver_id: shopOwnerId,
          message_type: 'prescription',
          deleted_at: null, // Only non-deleted messages
        },
        ...(cursor
          ? {
              cursor: { id: cursor },
              skip: 1,
            }
          : {}),
        take: limit,
        orderBy: {
          created_at: 'desc', // Most recent first
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
        },
      });

      // Add avatar URLs and format data
      // Type assertion needed because Prisma client types may not be fully regenerated
      for (const prescription of prescriptions as any[]) {
        if (prescription.sender?.avatar) {
          prescription.sender['avatar_url'] = SojebStorage.url(
            appConfig().storageUrl.avatar + prescription.sender.avatar,
          );
        }
        if (prescription.receiver?.avatar) {
          prescription.receiver['avatar_url'] = SojebStorage.url(
            appConfig().storageUrl.avatar + prescription.receiver.avatar,
          );
        }
      }

      return {
        success: true,
        data: prescriptions,
        count: prescriptions.length,
      };
    } catch (error) {
      // Handle known errors
      if (error instanceof HttpException) {
        throw error;
      }

      // Handle other errors
      throw new HttpException(
        error.message || 'Failed to fetch prescriptions',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get all conversations with doctors for a shop owner
   * Returns all doctor-shop_owner conversations
   * @param shopOwnerId - The ID of the shop owner
   * @returns List of conversations
   */
  async findAllConversations(shopOwnerId: string): Promise<any> {
    try {
      // Validate shop owner exists
      const shopOwner = await this.prisma.user.findUnique({
        where: { id: shopOwnerId },
        select: {
          id: true,
          type: true,
        },
      });

      if (!shopOwner) {
        throw new HttpException('Shop owner not found', HttpStatus.NOT_FOUND);
      }

      if (shopOwner.type !== 'shop_owner') {
        throw new HttpException(
          'Only shop owners can view their conversations',
          HttpStatus.FORBIDDEN,
        );
      }

      // Get all doctor-shop_owner conversations
      const conversations = await this.prisma.conversation.findMany({
        where: {
          type: 'doctor_shop_owner',
          OR: [{ creator_id: shopOwnerId }, { participant_id: shopOwnerId }],
          deleted_at: null, // Only non-deleted conversations
        },
        orderBy: {
          updated_at: 'desc', // Most recent first
        },
        select: {
          id: true,
          creator_id: true,
          participant_id: true,
          type: true,
          status: true,
          created_at: true,
          updated_at: true,
          creator: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
              type: true,
            },
          },
          participant: {
            select: {
              id: true,
              name: true,
              email: true,
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
   * Get a single prescription by ID
   * @param prescriptionId - The ID of the prescription
   * @param shopOwnerId - The ID of the shop owner
   * @returns The prescription
   */
  async findOnePrescription(
    prescriptionId: string,
    shopOwnerId: string,
  ): Promise<any> {
    try {
      // Validate shop owner exists
      const shopOwner = await this.prisma.user.findUnique({
        where: { id: shopOwnerId },
        select: {
          id: true,
          type: true,
        },
      });

      if (!shopOwner) {
        throw new HttpException('Shop owner not found', HttpStatus.NOT_FOUND);
      }

      if (shopOwner.type !== 'shop_owner') {
        throw new HttpException(
          'Only shop owners can view prescriptions',
          HttpStatus.FORBIDDEN,
        );
      }

      // Get the prescription
      // Type assertion needed because Prisma client types may not be fully regenerated
      const prescription = (await this.prisma.message.findFirst({
        where: {
          id: prescriptionId,
          receiver_id: shopOwnerId,
          message_type: 'prescription',
          deleted_at: null,
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
              avatar: true,
              type: true,
            },
          },
          conversation: {
            select: {
              id: true,
              type: true,
              status: true,
            },
          },
        },
      })) as any;

      if (!prescription) {
        throw new HttpException('Prescription not found', HttpStatus.NOT_FOUND);
      }

      // Add avatar URLs
      if (prescription.sender?.avatar) {
        prescription.sender['avatar_url'] = SojebStorage.url(
          appConfig().storageUrl.avatar + prescription.sender.avatar,
        );
      }
      if (prescription.receiver?.avatar) {
        prescription.receiver['avatar_url'] = SojebStorage.url(
          appConfig().storageUrl.avatar + prescription.receiver.avatar,
        );
      }

      return {
        success: true,
        data: prescription,
      };
    } catch (error) {
      // Handle known errors
      if (error instanceof HttpException) {
        throw error;
      }

      // Handle other errors
      throw new HttpException(
        error.message || 'Failed to fetch prescription',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
