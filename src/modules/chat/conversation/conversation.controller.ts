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

  // @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get all conversations' })
  @Get()
  async findAll() {
    try {
      const conversations = await this.conversationService.findAll();
      return conversations;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @ApiOperation({ summary: 'Get a conversation by id' })
  @Get(':id')
  async findOne(@Param('id') id: string) {
    try {
      const conversation = await this.conversationService.findOne(id);
      return conversation;
    } catch (error) {
      return {
        success: false,
        message: error.message,
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
