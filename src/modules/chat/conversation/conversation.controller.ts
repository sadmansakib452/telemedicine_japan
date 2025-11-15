import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  Request,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { RolesGuard } from '../../../common/guard/role/roles.guard';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Role } from '../../../common/guard/role/role.enum';
import { Roles } from '../../../common/guard/role/roles.decorator';

@ApiBearerAuth()
@ApiTags('Conversation')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('chat/conversation')
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  /**
   * Create a conversation
   * Can be a regular conversation or a conversation from a broadcast
   * @param createConversationDto - The conversation data
   * @returns Created conversation
   */
  @ApiOperation({
    summary: 'Create conversation',
    description:
      'Create a new conversation. If broadcast_id is provided, this creates a conversation from a broadcast (doctor responding to patient).',
  })
  @Post()
  async create(@Body() createConversationDto: CreateConversationDto) {
    try {
      const conversation = await this.conversationService.create(
        createConversationDto,
      );
      return conversation;
    } catch (error) {
      // Handle known errors
      if (error instanceof HttpException) {
        throw error;
      }

      // Handle other errors
      return {
        success: false,
        message: error.message || 'Failed to create conversation',
      };
    }
  }

  /**
   * Create a conversation from a broadcast (Doctor responding to patient)
   * This endpoint allows doctors to respond to patient broadcasts
   * Only one doctor can respond to a broadcast
   * @param broadcastId - The ID of the broadcast
   * @param req - The request object containing the authenticated user
   * @returns Created conversation
   */
  @ApiOperation({
    summary: 'Respond to broadcast (Doctor only)',
    description:
      'Doctors can respond to a patient broadcast. This creates a private conversation between the doctor and patient. Only one doctor can respond to a broadcast.',
  })
  @Post('broadcast/:broadcastId/respond')
  @Roles(Role.DOCTOR)
  async respondToBroadcast(
    @Param('broadcastId') broadcastId: string,
    @Request() req: any,
  ) {
    try {
      // Get the doctor ID from the JWT token
      const doctorId = req.user?.userId;

      if (!doctorId) {
        throw new HttpException(
          'User not authenticated',
          HttpStatus.UNAUTHORIZED,
        );
      }

      // Create conversation from broadcast
      const result = await this.conversationService.createFromBroadcast(
        broadcastId,
        doctorId,
      );

      return result;
    } catch (error) {
      // Handle known errors
      if (error instanceof HttpException) {
        throw error;
      }

      // Handle other errors
      return {
        success: false,
        message: error.message || 'Failed to respond to broadcast',
      };
    }
  }

  /**
   * Get all conversations for the authenticated user
   * Returns only conversations where the user is creator or participant
   * @param req - The request object containing the authenticated user
   * @returns List of conversations for the user
   */
  @ApiOperation({
    summary: 'Get all conversations for authenticated user',
    description:
      'Returns all conversations where the authenticated user is creator or participant. Users can only see their own conversations.',
  })
  @Get()
  async findAll(@Request() req: any) {
    try {
      // Extract user ID from JWT token
      const userId = req.user?.userId;

      // Validate user is authenticated
      if (!userId) {
        throw new HttpException(
          'User not authenticated',
          HttpStatus.UNAUTHORIZED,
        );
      }

      // Get all conversations for this user
      const conversations = await this.conversationService.findAll(userId);

      return conversations;
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
   * Get a conversation by ID
   * Returns conversation only if the authenticated user is creator or participant
   * @param id - The ID of the conversation
   * @param req - The request object containing the authenticated user
   * @returns The conversation
   */
  @ApiOperation({
    summary: 'Get a conversation by ID',
    description:
      'Returns a conversation by ID. Users can only access conversations where they are creator or participant. Returns 403 if user is not authorized.',
  })
  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req: any) {
    try {
      // Extract user ID from JWT token
      const userId = req.user?.userId;

      // Validate user is authenticated
      if (!userId) {
        throw new HttpException(
          'User not authenticated',
          HttpStatus.UNAUTHORIZED,
        );
      }

      // Get conversation (service handles authorization check)
      const conversation = await this.conversationService.findOne(id, userId);

      return conversation;
    } catch (error) {
      // Handle known errors
      if (error instanceof HttpException) {
        throw error;
      }

      // Handle other errors
      return {
        success: false,
        message: error.message || 'Failed to fetch conversation',
      };
    }
  }

  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Delete a conversation' })
  @Delete(':id')
  async remove(@Param('id') id: string) {
    try {
      const conversation = await this.conversationService.remove(id);
      return conversation;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}
