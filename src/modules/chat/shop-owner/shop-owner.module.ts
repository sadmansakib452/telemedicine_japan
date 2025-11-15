import { Module } from '@nestjs/common';
import { ShopOwnerService } from './shop-owner.service';
import { ShopOwnerController } from './shop-owner.controller';

/**
 * Shop Owner Module
 * Handles all shop owner-related functionality
 * - Shop owners can view all prescriptions they've received
 * - Shop owners can view their conversations with doctors
 */
@Module({
  controllers: [ShopOwnerController],
  providers: [ShopOwnerService],
  exports: [ShopOwnerService], // Export ShopOwnerService so it can be used by other modules if needed
})
export class ShopOwnerModule {}
