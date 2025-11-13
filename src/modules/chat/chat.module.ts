import { Module } from '@nestjs/common';
import { ConversationModule } from './conversation/conversation.module';
import { MessageModule } from './message/message.module';
import { UserModule } from './user/user.module';
import { BroadcastModule } from './broadcast/broadcast.module';
import { ShopOwnerModule } from './shop-owner/shop-owner.module';

@Module({
  imports: [
    ConversationModule,
    MessageModule,
    UserModule,
    BroadcastModule, // Add BroadcastModule for broadcast functionality
    ShopOwnerModule, // Add ShopOwnerModule for shop owner functionality
  ],
})
export class ChatModule {}
