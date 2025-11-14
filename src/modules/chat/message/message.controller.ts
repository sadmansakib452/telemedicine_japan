import {
  Controller,
  Post,
  Body,
  Req,
  UseGuards,
  Get,
  Query,
  Param,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { MessageService } from './message.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { MessageGateway } from './message.gateway';
import { Request } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@ApiBearerAuth()
@ApiTags('Message')
@UseGuards(JwtAuthGuard)
@Controller('chat/message')
export class MessageController {
  constructor(
    private readonly messageService: MessageService,
    private readonly messageGateway: MessageGateway,
  ) {}

  /**
   * Send a message
   * Supports both text messages and prescription messages
   * Only doctors can create prescription messages
   * @param req - The request object containing the authenticated user
   * @param createMessageDto - The message data
   * @returns Created message
   */
  @ApiOperation({
    summary: 'Send message',
    description:
      'Send a text message or prescription message. Only doctors can create prescription messages.',
  })
  @Post()
  async create(
    @Req() req: Request,
    @Body() createMessageDto: CreateMessageDto,
  ) {
    try {
      const user_id = req.user.userId;
      const result = await this.messageService.create(
        user_id,
        createMessageDto,
      );

      // WebSocket events are handled in the service
      // Return the result
      return result;
    } catch (error) {
      // Handle known errors
      if (error instanceof HttpException) {
        throw error;
      }

      // Handle other errors
      return {
        success: false,
        message: error.message || 'Failed to send message',
      };
    }
  }

  /**
   * Get all messages in a conversation
   * Returns messages with prescription data if applicable
   * @param req - The request object containing the authenticated user
   * @param query - Query parameters (conversation_id, limit, cursor)
   * @returns List of messages
   */
  @ApiOperation({
    summary: 'Get all messages',
    description:
      'Get all messages in a conversation. Returns messages with prescription data if applicable.',
  })
  @Get()
  async findAll(
    @Req() req: Request,
    @Query()
    query: { conversation_id: string; limit?: number; cursor?: string },
  ) {
    try {
      const user_id = req.user.userId;
      const conversation_id = query.conversation_id as string;
      const limit = Number(query.limit) || 20;
      const cursor = query.cursor as string;

      if (!conversation_id) {
        throw new HttpException('Conversation ID is required', 400);
      }

      const messages = await this.messageService.findAll({
        user_id,
        conversation_id,
        limit,
        cursor,
      });

      return messages;
    } catch (error) {
      // Handle known errors
      if (error instanceof HttpException) {
        throw error;
      }

      // Handle other errors
      return {
        success: false,
        message: error.message || 'Failed to fetch messages',
      };
    }
  }

  /**
   * Get a single message by ID
   * Returns message with prescription data if applicable
   * Verifies that the user is authorized to access this message
   * @param id - The ID of the message
   * @param req - The request object containing the authenticated user
   * @returns The message
   */
  @ApiOperation({
    summary: 'Get a single message by ID',
    description:
      'Get a single message by its ID. Returns message with prescription data if applicable. User must be sender, receiver, or conversation participant.',
  })
  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: Request) {
    try {
      const user_id = req.user.userId;

      if (!user_id) {
        throw new HttpException(
          'User not authenticated',
          HttpStatus.UNAUTHORIZED,
        );
      }

      const result = await this.messageService.findOne(id, user_id);

      return result;
    } catch (error) {
      // Handle known errors
      if (error instanceof HttpException) {
        throw error;
      }

      // Handle other errors
      return {
        success: false,
        message: error.message || 'Failed to fetch message',
      };
    }
  }
}
