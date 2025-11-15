import { Module } from '@nestjs/common';
import { BroadcastService } from './broadcast.service';
import { BroadcastController } from './broadcast.controller';

/**
 * Broadcast Module
 * Handles all broadcast-related functionality
 * - Patients can create broadcasts (medical issue messages)
 * - Doctors can view all open broadcasts in their inbox
 * - When a doctor responds, the broadcast status is updated to "assisted"
 * Note: MessageModule is Global, so MessageGateway is available without explicit import
 */
@Module({
  controllers: [BroadcastController],
  providers: [BroadcastService],
  exports: [BroadcastService], // Export BroadcastService so it can be used by other modules (e.g., ConversationModule)
})
export class BroadcastModule {}

