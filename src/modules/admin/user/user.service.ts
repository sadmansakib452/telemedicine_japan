import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from '../../../prisma/prisma.service';
import { UserRepository } from '../../../common/repository/user/user.repository';
import appConfig from '../../../config/app.config';
import { SojebStorage } from '../../../common/lib/Disk/SojebStorage';
import { DateHelper } from '../../../common/helper/date.helper';

/**
 * Admin User Service
 * Handles all admin-related user operations
 * - View all users
 * - Approve/reject doctor and shop owner accounts
 * - View pending verification requests
 * - View system activities (conversations, prescriptions, broadcasts)
 */
@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    try {
      const user = await UserRepository.createUser(createUserDto);

      if (user.success) {
        return {
          success: user.success,
          message: user.message,
        };
      } else {
        return {
          success: user.success,
          message: user.message,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * Get all users with filtering
   * Admins can view all users with various filters
   * @param q - Search query (name or email)
   * @param type - User type filter (patient, doctor, shop_owner, admin)
   * @param approved - Approval status filter (approved, pending)
   * @returns List of users
   */
  async findAll({
    q,
    type,
    approved,
  }: {
    q?: string;
    type?: string;
    approved?: string;
  }) {
    try {
      const where_condition: any = {
        deleted_at: null, // Only non-deleted users
      };

      if (q) {
        where_condition['OR'] = [
          { name: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
        ];
      }

      if (type) {
        where_condition['type'] = type;
      }

      if (approved) {
        where_condition['approved_at'] =
          approved == 'approved' ? { not: null } : null;
      }

      const users = await this.prisma.user.findMany({
        where: where_condition,
        orderBy: {
          created_at: 'desc', // Most recent first
        },
        select: {
          id: true,
          name: true,
          first_name: true,
          last_name: true,
          email: true,
          phone_number: true,
          address: true,
          city: true,
          state: true,
          country: true,
          type: true,
          approved_at: true,
          email_verified_at: true,
          created_at: true,
          updated_at: true,
          avatar: true,
        },
      });

      // Add avatar URLs
      for (const user of users) {
        if (user.avatar) {
          user['avatar_url'] = SojebStorage.url(
            appConfig().storageUrl.avatar + user.avatar,
          );
        }
      }

      return {
        success: true,
        data: users,
        count: users.length,
      };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to fetch users',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findOne(id: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: {
          id: id,
        },
        select: {
          id: true,
          name: true,
          first_name: true,
          last_name: true,
          email: true,
          type: true,
          phone_number: true,
          address: true,
          city: true,
          state: true,
          country: true,
          approved_at: true,
          email_verified_at: true,
          created_at: true,
          updated_at: true,
          avatar: true,
          billing_id: true,
        },
      });

      if (!user) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }

      // Add avatar URL
      if (user.avatar) {
        user['avatar_url'] = SojebStorage.url(
          appConfig().storageUrl.avatar + user.avatar,
        );
      }

      return {
        success: true,
        data: user,
      };
    } catch (error) {
      // Handle known errors
      if (error instanceof HttpException) {
        throw error;
      }

      // Handle other errors
      throw new HttpException(
        error.message || 'Failed to fetch user',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get pending verification requests
   * Returns all doctors and shop owners waiting for approval
   * @returns List of pending verification requests
   */
  async findPendingVerifications(): Promise<any> {
    try {
      const pendingUsers = await this.prisma.user.findMany({
        where: {
          type: {
            in: ['doctor', 'shop_owner'], // Only doctors and shop owners need verification
          },
          approved_at: null, // Not yet approved
          deleted_at: null, // Only active users
        },
        orderBy: {
          created_at: 'desc', // Most recent first
        },
        select: {
          id: true,
          name: true,
          first_name: true,
          last_name: true,
          email: true,
          phone_number: true,
          address: true,
          city: true,
          state: true,
          country: true,
          type: true,
          approved_at: true,
          created_at: true,
          updated_at: true,
          avatar: true,
        },
      });

      // Add avatar URLs
      for (const user of pendingUsers) {
        if (user.avatar) {
          user['avatar_url'] = SojebStorage.url(
            appConfig().storageUrl.avatar + user.avatar,
          );
        }
      }

      return {
        success: true,
        data: pendingUsers,
        count: pendingUsers.length,
      };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to fetch pending verifications',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Approve a user (doctor or shop owner)
   * Sets the approved_at timestamp to the current time
   * @param id - The ID of the user to approve
   * @returns Success message
   */
  async approve(id: string) {
    try {
      // Validate user exists
      const user = await this.prisma.user.findUnique({
        where: { id: id },
        select: {
          id: true,
          type: true,
          approved_at: true,
          deleted_at: true,
        },
      });

      if (!user) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }

      if (user.deleted_at) {
        throw new HttpException(
          'Cannot approve a deleted user',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Only doctors and shop owners need approval
      if (user.type !== 'doctor' && user.type !== 'shop_owner') {
        throw new HttpException(
          `Users with type "${user.type}" do not require approval`,
          HttpStatus.BAD_REQUEST,
        );
      }

      // Check if already approved
      if (user.approved_at) {
        throw new HttpException(
          'User is already approved',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Approve the user
      await this.prisma.user.update({
        where: { id: id },
        data: { approved_at: DateHelper.now() },
      });

      return {
        success: true,
        message: `User (${user.type}) approved successfully`,
      };
    } catch (error) {
      // Handle known errors
      if (error instanceof HttpException) {
        throw error;
      }

      // Handle database errors
      if (error.code === 'P2025') {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }

      // Handle other errors
      throw new HttpException(
        error.message || 'Failed to approve user',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Reject a user (doctor or shop owner)
   * Sets the approved_at timestamp to null
   * @param id - The ID of the user to reject
   * @returns Success message
   */
  async reject(id: string) {
    try {
      // Validate user exists
      const user = await this.prisma.user.findUnique({
        where: { id: id },
        select: {
          id: true,
          type: true,
          approved_at: true,
          deleted_at: true,
        },
      });

      if (!user) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }

      if (user.deleted_at) {
        throw new HttpException(
          'Cannot reject a deleted user',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Only doctors and shop owners need approval
      if (user.type !== 'doctor' && user.type !== 'shop_owner') {
        throw new HttpException(
          `Users with type "${user.type}" do not require approval`,
          HttpStatus.BAD_REQUEST,
        );
      }

      // Reject the user (set approved_at to null)
      await this.prisma.user.update({
        where: { id: id },
        data: { approved_at: null },
      });

      return {
        success: true,
        message: `User (${user.type}) rejected successfully`,
      };
    } catch (error) {
      // Handle known errors
      if (error instanceof HttpException) {
        throw error;
      }

      // Handle database errors
      if (error.code === 'P2025') {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }

      // Handle other errors
      throw new HttpException(
        error.message || 'Failed to reject user',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    try {
      const user = await UserRepository.updateUser(id, updateUserDto);

      if (user.success) {
        return {
          success: user.success,
          message: user.message,
        };
      } else {
        return {
          success: user.success,
          message: user.message,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async remove(id: string) {
    try {
      const user = await UserRepository.deleteUser(id);
      return user;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * Get all conversations (Admin view-only)
   * Returns all conversations in the system
   * @param limit - Maximum number of conversations to return
   * @param cursor - Cursor for pagination
   * @returns List of conversations
   */
  async findAllConversations(
    limit: number = 20,
    cursor?: string,
  ): Promise<any> {
    try {
      const findManyOptions: any = {
        where: {
          deleted_at: null, // Only non-deleted conversations
        },
        take: limit,
        orderBy: {
          updated_at: 'desc', // Most recent first
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
              email: true,
              type: true,
              avatar: true,
            },
          },
          participant: {
            select: {
              id: true,
              name: true,
              email: true,
              type: true,
              avatar: true,
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
      };

      // Add cursor-based pagination if cursor is provided
      if (cursor) {
        findManyOptions.cursor = { id: cursor };
        findManyOptions.skip = 1;
      }

      const conversations =
        await this.prisma.conversation.findMany(findManyOptions);

      // Add avatar URLs
      for (const conversation of conversations as any[]) {
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
      throw new HttpException(
        error.message || 'Failed to fetch conversations',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get all prescriptions (Admin view-only)
   * Returns all prescriptions in the system
   * @param limit - Maximum number of prescriptions to return
   * @param cursor - Cursor for pagination
   * @returns List of prescriptions
   */
  async findAllPrescriptions(
    limit: number = 20,
    cursor?: string,
  ): Promise<any> {
    try {
      const findManyOptions: any = {
        where: {
          message_type: 'prescription',
          deleted_at: null, // Only non-deleted messages
        },
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
              type: true,
              avatar: true,
            },
          },
          receiver: {
            select: {
              id: true,
              name: true,
              email: true,
              type: true,
              avatar: true,
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
      };

      // Add cursor-based pagination if cursor is provided
      if (cursor) {
        findManyOptions.cursor = { id: cursor };
        findManyOptions.skip = 1;
      }

      const prescriptions = await this.prisma.message.findMany(findManyOptions);

      // Add avatar URLs
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
      throw new HttpException(
        error.message || 'Failed to fetch prescriptions',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get all broadcasts (Admin view-only)
   * Returns all broadcasts in the system
   * @param limit - Maximum number of broadcasts to return
   * @param cursor - Cursor for pagination
   * @returns List of broadcasts
   */
  async findAllBroadcasts(limit: number = 20, cursor?: string): Promise<any> {
    try {
      const findManyOptions: any = {
        where: {
          deleted_at: null, // Only non-deleted broadcasts
        },
        take: limit,
        orderBy: {
          created_at: 'desc', // Most recent first
        },
        select: {
          id: true,
          patient_id: true,
          message: true,
          status: true,
          assisted_by: true,
          conversation_id: true,
          created_at: true,
          updated_at: true,
          patient: {
            select: {
              id: true,
              name: true,
              email: true,
              type: true,
              avatar: true,
            },
          },
        },
      };

      // Add cursor-based pagination if cursor is provided
      if (cursor) {
        findManyOptions.cursor = { id: cursor };
        findManyOptions.skip = 1;
      }

      const broadcasts = await this.prisma.broadcast.findMany(findManyOptions);

      // Add avatar URLs
      for (const broadcast of broadcasts as any[]) {
        if (broadcast.patient?.avatar) {
          broadcast.patient['avatar_url'] = SojebStorage.url(
            appConfig().storageUrl.avatar + broadcast.patient.avatar,
          );
        }
      }

      return {
        success: true,
        data: broadcasts,
        count: broadcasts.length,
      };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to fetch broadcasts',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get system statistics (Admin view-only)
   * Returns statistics about users, conversations, prescriptions, and broadcasts
   * @returns System statistics
   */
  async getSystemStatistics(): Promise<any> {
    try {
      // Get user counts
      const userCounts = await this.prisma.user.groupBy({
        by: ['type'],
        where: {
          deleted_at: null,
        },
        _count: {
          id: true,
        },
      });

      // Get approved user counts
      const approvedUserCounts = await this.prisma.user.groupBy({
        by: ['type'],
        where: {
          deleted_at: null,
          approved_at: {
            not: null,
          },
        },
        _count: {
          id: true,
        },
      });

      // Get pending verification counts
      const pendingCounts = await this.prisma.user.groupBy({
        by: ['type'],
        where: {
          deleted_at: null,
          approved_at: null,
          type: {
            in: ['doctor', 'shop_owner'],
          },
        },
        _count: {
          id: true,
        },
      });

      // Get conversation counts
      const conversationCount = await this.prisma.conversation.count({
        where: {
          deleted_at: null,
        },
      });

      // Get prescription counts
      const prescriptionCount = await this.prisma.message.count({
        where: {
          message_type: 'prescription',
          deleted_at: null,
        },
      });

      // Get broadcast counts
      const broadcastCount = await this.prisma.broadcast.count({
        where: {
          deleted_at: null,
        },
      });

      // Get open broadcast counts
      const openBroadcastCount = await this.prisma.broadcast.count({
        where: {
          status: 'open',
          deleted_at: null,
        },
      });

      // Format statistics
      const statistics = {
        users: {
          total: userCounts.reduce((sum, item) => sum + item._count.id, 0),
          by_type: userCounts.reduce(
            (acc, item) => {
              acc[item.type || 'unknown'] = item._count.id;
              return acc;
            },
            {} as Record<string, number>,
          ),
        },
        approved_users: {
          total: approvedUserCounts.reduce(
            (sum, item) => sum + item._count.id,
            0,
          ),
          by_type: approvedUserCounts.reduce(
            (acc, item) => {
              acc[item.type || 'unknown'] = item._count.id;
              return acc;
            },
            {} as Record<string, number>,
          ),
        },
        pending_verifications: {
          total: pendingCounts.reduce((sum, item) => sum + item._count.id, 0),
          by_type: pendingCounts.reduce(
            (acc, item) => {
              acc[item.type || 'unknown'] = item._count.id;
              return acc;
            },
            {} as Record<string, number>,
          ),
        },
        conversations: {
          total: conversationCount,
        },
        prescriptions: {
          total: prescriptionCount,
        },
        broadcasts: {
          total: broadcastCount,
          open: openBroadcastCount,
          assisted: broadcastCount - openBroadcastCount,
        },
      };

      return {
        success: true,
        data: statistics,
      };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to fetch system statistics',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
