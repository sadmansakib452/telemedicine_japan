import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Request,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ShopOwnerService } from './shop-owner.service';
import { RolesGuard } from '../../../common/guard/role/roles.guard';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Role } from '../../../common/guard/role/role.enum';
import { Roles } from '../../../common/guard/role/roles.decorator';

/**
 * Shop Owner Controller
 * Handles HTTP requests for shop owner operations
 * - Shop owners can view all prescriptions they've received
 * - Shop owners can view their conversations with doctors
 */
@ApiBearerAuth()
@ApiTags('Shop Owner')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('chat/shop-owner')
export class ShopOwnerController {
  constructor(private readonly shopOwnerService: ShopOwnerService) {}

  /**
   * Get all prescriptions for the authenticated shop owner
   * @param req - The request object containing the authenticated user
   * @param query - Query parameters (limit, cursor)
   * @returns List of prescriptions
   */
  @ApiOperation({
    summary: 'Get all prescriptions (Shop Owner only)',
    description:
      'Get all prescriptions that have been distributed to the authenticated shop owner. Prescriptions are automatically sent when doctors create them.',
  })
  @Get('prescriptions')
  @Roles(Role.SHOP_OWNER)
  async findAllPrescriptions(
    @Request() req: any,
    @Query() query: { limit?: number; cursor?: string },
  ) {
    try {
      // Get the shop owner ID from the JWT token
      const shopOwnerId = req.user?.userId;

      if (!shopOwnerId) {
        throw new HttpException(
          'User not authenticated',
          HttpStatus.UNAUTHORIZED,
        );
      }

      const limit = Number(query.limit) || 20;
      const cursor = query.cursor;

      // Get all prescriptions
      const result = await this.shopOwnerService.findAllPrescriptions(
        shopOwnerId,
        limit,
        cursor,
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
        message: error.message || 'Failed to fetch prescriptions',
      };
    }
  }

  /**
   * Get a single prescription by ID
   * @param id - The ID of the prescription
   * @param req - The request object containing the authenticated user
   * @returns The prescription
   */
  @ApiOperation({
    summary: 'Get a prescription by ID (Shop Owner only)',
    description:
      'Get a single prescription by its ID. Only shop owners can view their own prescriptions.',
  })
  @Get('prescriptions/:id')
  @Roles(Role.SHOP_OWNER)
  async findOnePrescription(@Param('id') id: string, @Request() req: any) {
    try {
      // Get the shop owner ID from the JWT token
      const shopOwnerId = req.user?.userId;

      if (!shopOwnerId) {
        throw new HttpException(
          'User not authenticated',
          HttpStatus.UNAUTHORIZED,
        );
      }

      // Get the prescription
      const result = await this.shopOwnerService.findOnePrescription(
        id,
        shopOwnerId,
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
        message: error.message || 'Failed to fetch prescription',
      };
    }
  }

  /**
   * Get all conversations with doctors for the authenticated shop owner
   * @param req - The request object containing the authenticated user
   * @returns List of conversations
   */
  @ApiOperation({
    summary: 'Get all conversations with doctors (Shop Owner only)',
    description:
      'Get all conversations with doctors. Each conversation contains prescriptions from that doctor.',
  })
  @Get('conversations')
  @Roles(Role.SHOP_OWNER)
  async findAllConversations(@Request() req: any) {
    try {
      // Get the shop owner ID from the JWT token
      const shopOwnerId = req.user?.userId;

      if (!shopOwnerId) {
        throw new HttpException(
          'User not authenticated',
          HttpStatus.UNAUTHORIZED,
        );
      }

      // Get all conversations
      const result =
        await this.shopOwnerService.findAllConversations(shopOwnerId);

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
}
