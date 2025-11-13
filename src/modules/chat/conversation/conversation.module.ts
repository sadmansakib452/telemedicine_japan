import { Module, forwardRef } from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { ConversationController } from './conversation.controller';
import { BroadcastModule } from '../broadcast/broadcast.module';

/**
 * Conversation Module
 * Handles all conversation-related functionality
 * - Creates conversations between users
 * - Integrates with broadcasts (when a doctor responds to a patient's broadcast)
 */
@Module({
  imports: [forwardRef(() => BroadcastModule)], // Import BroadcastModule to use BroadcastService
  controllers: [ConversationController],
  providers: [ConversationService],
  exports: [ConversationService], // Export ConversationService so it can be used by other modules
})
export class ConversationModule {}
