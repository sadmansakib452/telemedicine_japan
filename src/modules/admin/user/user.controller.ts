import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import {
  ApiBearerAuth,
  ApiResponse,
  ApiTags,
  ApiOperation,
} from '@nestjs/swagger';
import { Role } from '../../../common/guard/role/role.enum';
import { Roles } from '../../../common/guard/role/roles.decorator';
import { RolesGuard } from '../../../common/guard/role/roles.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

/**
 * Admin User Controller
 * Handles HTTP requests for admin user operations
 * - View all users
 * - Approve/reject doctor and shop owner accounts
 * - View pending verification requests
 * - View system activities (conversations, prescriptions, broadcasts)
 */
@ApiBearerAuth()
@ApiTags('Admin User')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @ApiResponse({ description: 'Create a user' })
  @Post()
  async create(@Body() createUserDto: CreateUserDto) {
    try {
      const user = await this.userService.create(createUserDto);
      return user;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @ApiResponse({ description: 'Get all users' })
  @Get()
  async findAll(
    @Query() query: { q?: string; type?: string; approved?: string },
  ) {
    try {
      const q = query.q;
      const type = query.type;
      const approved = query.approved;

      const users = await this.userService.findAll({ q, type, approved });
      return users;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * Get pending verification requests
   * Returns all doctors and shop owners waiting for approval
   * @returns List of pending verification requests
   */
  @ApiOperation({
    summary: 'Get pending verification requests (Admin only)',
    description:
      'Get all doctors and shop owners who are waiting for admin approval. Only doctors and shop owners require verification.',
  })
  @Get('verifications/pending')
  async findPendingVerifications() {
    try {
      const result = await this.userService.findPendingVerifications();
      return result;
    } catch (error) {
      // Handle known errors
      if (error instanceof HttpException) {
        throw error;
      }

      // Handle other errors
      return {
        success: false,
        message: error.message || 'Failed to fetch pending verifications',
      };
    }
  }

  /**
   * Approve a user (doctor or shop owner)
   * Sets the approved_at timestamp to the current time
   * @param id - The ID of the user to approve
   * @returns Success message
   */
  @ApiOperation({
    summary: 'Approve a user (Admin only)',
    description:
      'Approve a doctor or shop owner account. This sets the approved_at timestamp, allowing them to use the platform.',
  })
  @Post(':id/approve')
  async approve(@Param('id') id: string) {
    try {
      const result = await this.userService.approve(id);
      return result;
    } catch (error) {
      // Handle known errors
      if (error instanceof HttpException) {
        throw error;
      }

      // Handle other errors
      return {
        success: false,
        message: error.message || 'Failed to approve user',
      };
    }
  }

  /**
   * Reject a user (doctor or shop owner)
   * Sets the approved_at timestamp to null
   * @param id - The ID of the user to reject
   * @returns Success message
   */
  @ApiOperation({
    summary: 'Reject a user (Admin only)',
    description:
      'Reject a doctor or shop owner account. This sets the approved_at timestamp to null, preventing them from using the platform.',
  })
  @Post(':id/reject')
  async reject(@Param('id') id: string) {
    try {
      const result = await this.userService.reject(id);
      return result;
    } catch (error) {
      // Handle known errors
      if (error instanceof HttpException) {
        throw error;
      }

      // Handle other errors
      return {
        success: false,
        message: error.message || 'Failed to reject user',
      };
    }
  }

  /**
   * Get all conversations (Admin view-only)
   * Returns all conversations in the system
   * @param query - Query parameters (limit, cursor)
   * @returns List of conversations
   */
  @ApiOperation({
    summary: 'Get all conversations (Admin view-only)',
    description:
      'View all conversations in the system. This includes patient-doctor and doctor-shop_owner conversations.',
  })
  @Get('conversations')
  async findAllConversations(
    @Query() query: { limit?: number; cursor?: string },
  ) {
    try {
      const limit = Number(query.limit) || 20;
      const cursor = query.cursor;

      const result = await this.userService.findAllConversations(limit, cursor);
      return result;
    } catch (error) {
      // Handle known errors
      if (error instanceof HttpException) {
        throw error;
      }

      // Handle other errors
      return {
        success: false,
        message: error.message || 'Failed to fetch conversations',
      };
    }
  }

  /**
   * Get all prescriptions (Admin view-only)
   * Returns all prescriptions in the system
   * @param query - Query parameters (limit, cursor)
   * @returns List of prescriptions
   */
  @ApiOperation({
    summary: 'Get all prescriptions (Admin view-only)',
    description:
      'View all prescriptions in the system. This includes all prescriptions created by doctors and distributed to shop owners.',
  })
  @Get('prescriptions')
  async findAllPrescriptions(
    @Query() query: { limit?: number; cursor?: string },
  ) {
    try {
      const limit = Number(query.limit) || 20;
      const cursor = query.cursor;

      const result = await this.userService.findAllPrescriptions(limit, cursor);
      return result;
    } catch (error) {
      // Handle known errors
      if (error instanceof HttpException) {
        throw error;
      }

      // Handle other errors
      return {
        success: false,
        message: error.message || 'Failed to fetch prescriptions',
      };
    }
  }

  /**
   * Get all broadcasts (Admin view-only)
   * Returns all broadcasts in the system
   * @param query - Query parameters (limit, cursor)
   * @returns List of broadcasts
   */
  @ApiOperation({
    summary: 'Get all broadcasts (Admin view-only)',
    description:
      'View all broadcasts in the system. This includes all patient broadcasts and their status (open, assisted, closed).',
  })
  @Get('broadcasts')
  async findAllBroadcasts(@Query() query: { limit?: number; cursor?: string }) {
    try {
      const limit = Number(query.limit) || 20;
      const cursor = query.cursor;

      const result = await this.userService.findAllBroadcasts(limit, cursor);
      return result;
    } catch (error) {
      // Handle known errors
      if (error instanceof HttpException) {
        throw error;
      }

      // Handle other errors
      return {
        success: false,
        message: error.message || 'Failed to fetch broadcasts',
      };
    }
  }

  /**
   * Get system statistics (Admin view-only)
   * Returns statistics about users, conversations, prescriptions, and broadcasts
   * @returns System statistics
   */
  @ApiOperation({
    summary: 'Get system statistics (Admin view-only)',
    description:
      'View system statistics including user counts, conversation counts, prescription counts, and broadcast counts.',
  })
  @Get('statistics')
  async getSystemStatistics() {
    try {
      const result = await this.userService.getSystemStatistics();
      return result;
    } catch (error) {
      // Handle known errors
      if (error instanceof HttpException) {
        throw error;
      }

      // Handle other errors
      return {
        success: false,
        message: error.message || 'Failed to fetch system statistics',
      };
    }
  }

  /**
   * Get a single user by ID
   * Admins can view any user's details
   * @param id - The ID of the user
   * @returns User details
   */
  @ApiOperation({
    summary: 'Get a user by ID (Admin only)',
    description: "View a single user's details by their ID.",
  })
  @Get(':id')
  async findOne(@Param('id') id: string) {
    try {
      const result = await this.userService.findOne(id);
      return result;
    } catch (error) {
      // Handle known errors
      if (error instanceof HttpException) {
        throw error;
      }

      // Handle other errors
      return {
        success: false,
        message: error.message || 'Failed to fetch user',
      };
    }
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    try {
      const user = await this.userService.update(id, updateUserDto);
      return user;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    try {
      const user = await this.userService.remove(id);
      return user;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}
