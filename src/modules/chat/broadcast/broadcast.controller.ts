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
import { BroadcastService } from './broadcast.service';
import { CreateBroadcastDto } from './dto/create-broadcast.dto';
import { UpdateBroadcastDto } from './dto/update-broadcast.dto';
import { RolesGuard } from '../../../common/guard/role/roles.guard';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Role } from '../../../common/guard/role/role.enum';
import { Roles } from '../../../common/guard/role/roles.decorator';
import { GetUser } from '../../auth/decorators/get-user.decorator';

/**
 * Broadcast Controller
 * Handles HTTP requests for broadcast operations
 * - Patients can create and view their own broadcasts
 * - Doctors can view all open broadcasts in their inbox
 */
@ApiBearerAuth()
@ApiTags('Broadcast')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('chat/broadcast')
export class BroadcastController {
  constructor(private readonly broadcastService: BroadcastService) {}

  /**
   * Create a new broadcast (Patient only)
   * Patients can send a medical issue message that will be broadcasted to all doctors
   * @param createBroadcastDto - The broadcast data (message)
   * @param req - The request object containing the authenticated user
   * @returns Created broadcast
   */
  @ApiOperation({
    summary: 'Create a new broadcast (Patient only)',
    description:
      'Patients can create a broadcast with their medical issue. This will be sent to all verified doctors.',
  })
  @Post()
  @Roles(Role.PATIENT)
  async create(
    @Body() createBroadcastDto: CreateBroadcastDto,
    @Request() req: any,
  ) {
    try {
      // Get the patient ID from the JWT token
      const patientId = req.user?.userId;

      if (!patientId) {
        throw new HttpException(
          'User not authenticated',
          HttpStatus.UNAUTHORIZED,
        );
      }

      // Create the broadcast
      const result = await this.broadcastService.create(
        createBroadcastDto,
        patientId,
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
        message: error.message || 'Failed to create broadcast',
      };
    }
  }

  /**
   * Get all broadcasts for the authenticated patient (Patient only)
   * Patients can view their own broadcasts
   * @param req - The request object containing the authenticated user
   * @returns List of broadcasts created by the patient
   */
  @ApiOperation({
    summary: 'Get all broadcasts for patient (Patient only)',
    description:
      'Patients can view all broadcasts they have created, including their status (open, assisted, closed).',
  })
  @Get('patient')
  @Roles(Role.PATIENT)
  async findAllByPatient(@Request() req: any) {
    try {
      // Get the patient ID from the JWT token
      const patientId = req.user?.userId;

      if (!patientId) {
        throw new HttpException(
          'User not authenticated',
          HttpStatus.UNAUTHORIZED,
        );
      }

      // Get all broadcasts for this patient
      const result = await this.broadcastService.findAllByPatient(patientId);

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
   * Get all open broadcasts for doctors (Doctor only)
   * Doctors can view all open broadcasts in their inbox
   * @returns List of all open broadcasts
   */
  @ApiOperation({
    summary: 'Get all open broadcasts for doctors (Doctor only)',
    description:
      'Doctors can view all open broadcasts (medical issues) from patients. Once a doctor responds, the broadcast status changes to "assisted".',
  })
  @Get('inbox')
  @Roles(Role.DOCTOR)
  async findAllOpenForDoctors() {
    try {
      // Get all open broadcasts
      const result = await this.broadcastService.findAllOpenForDoctors();

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
   * Get a single broadcast by ID
   * Patients can view their own broadcasts, doctors can view any broadcast
   * @param id - The ID of the broadcast
   * @param req - The request object containing the authenticated user
   * @returns The broadcast
   */
  @ApiOperation({
    summary: 'Get a broadcast by ID',
    description:
      'Get a single broadcast by its ID. Patients can view their own broadcasts, doctors can view any broadcast.',
  })
  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req: any) {
    try {
      // Get the broadcast
      const result = await this.broadcastService.findOne(id);

      // Check if user is authorized to view this broadcast
      const userId = req.user?.userId;
      const userType = req.user?.type || req.user?.user?.type;

      // Patients can only view their own broadcasts
      if (userType === 'patient' && result.data?.patient_id !== userId) {
        throw new HttpException(
          'You are not authorized to view this broadcast',
          HttpStatus.FORBIDDEN,
        );
      }

      return result;
    } catch (error) {
      // Handle known errors
      if (error instanceof HttpException) {
        throw error;
      }

      // Handle other errors
      return {
        success: false,
        message: error.message || 'Failed to fetch broadcast',
      };
    }
  }

  /**
   * Update a broadcast (Doctor only)
   * Doctors can update the broadcast status when they respond (changes status to "assisted")
   * @param id - The ID of the broadcast
   * @param updateBroadcastDto - The update data (status, assisted_by, conversation_id)
   * @param req - The request object containing the authenticated user
   * @returns Updated broadcast
   */
  @ApiOperation({
    summary: 'Update a broadcast (Doctor only)',
    description:
      'Doctors can update a broadcast when they respond. This changes the status to "assisted" and links it to a conversation.',
  })
  @Post(':id/update')
  @Roles(Role.DOCTOR)
  async update(
    @Param('id') id: string,
    @Body() updateBroadcastDto: UpdateBroadcastDto,
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

      // Ensure the doctor is setting themselves as the one who assisted
      if (!updateBroadcastDto.assisted_by) {
        updateBroadcastDto.assisted_by = doctorId;
      }

      // If status is not provided, default to "assisted"
      if (!updateBroadcastDto.status) {
        updateBroadcastDto.status = 'assisted';
      }

      // Update the broadcast
      const result = await this.broadcastService.update(id, updateBroadcastDto);

      return result;
    } catch (error) {
      // Handle known errors
      if (error instanceof HttpException) {
        throw error;
      }

      // Handle other errors
      return {
        success: false,
        message: error.message || 'Failed to update broadcast',
      };
    }
  }

  /**
   * Delete a broadcast (Patient only)
   * Patients can delete their own broadcasts
   * @param id - The ID of the broadcast
   * @param req - The request object containing the authenticated user
   * @returns Success message
   */
  @ApiOperation({
    summary: 'Delete a broadcast (Patient only)',
    description:
      'Patients can delete their own broadcasts. This is a soft delete operation.',
  })
  @Delete(':id')
  @Roles(Role.PATIENT)
  async remove(@Param('id') id: string, @Request() req: any) {
    try {
      // Get the patient ID from the JWT token
      const patientId = req.user?.userId;

      if (!patientId) {
        throw new HttpException(
          'User not authenticated',
          HttpStatus.UNAUTHORIZED,
        );
      }

      // Check if the broadcast belongs to this patient
      const broadcast = await this.broadcastService.findOne(id);
      if (broadcast.data?.patient_id !== patientId) {
        throw new HttpException(
          'You are not authorized to delete this broadcast',
          HttpStatus.FORBIDDEN,
        );
      }

      // Delete the broadcast
      const result = await this.broadcastService.remove(id);

      return result;
    } catch (error) {
      // Handle known errors
      if (error instanceof HttpException) {
        throw error;
      }

      // Handle other errors
      return {
        success: false,
        message: error.message || 'Failed to delete broadcast',
      };
    }
  }
}
