import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateBroadcastDto } from './dto/create-broadcast.dto';
import { UpdateBroadcastDto } from './dto/update-broadcast.dto';
import { DateHelper } from '../../../common/helper/date.helper';
import { SojebStorage } from '../../../common/lib/Disk/SojebStorage';
import appConfig from '../../../config/app.config';
import { MessageGateway } from '../message/message.gateway';

/**
 * Broadcast Service
 * Handles all business logic related to broadcasts
 * - Patients can create broadcasts (medical issue messages)
 * - Doctors can view all open broadcasts in their inbox
 * - When a doctor responds, the broadcast status is updated to "assisted"
 */
@Injectable()
export class BroadcastService {
  constructor(
    private prisma: PrismaService,
    private readonly messageGateway: MessageGateway,
  ) {}

  /**
   * Create a new broadcast
   * When a patient creates a broadcast, it is automatically visible to all verified doctors
   * @param createBroadcastDto - The broadcast data (message and patient_id)
   * @param patientId - The ID of the patient (from JWT token)
   * @returns Created broadcast with patient information
   */
  async create(
    createBroadcastDto: CreateBroadcastDto,
    patientId: string,
  ): Promise<any> {
    try {
      // Validate that the user is a patient
      const patient = await this.prisma.user.findUnique({
        where: { id: patientId },
        select: {
          id: true,
          name: true,
          email: true,
          type: true,
          avatar: true,
        },
      });

      if (!patient) {
        throw new HttpException('Patient not found', HttpStatus.NOT_FOUND);
      }

      if (patient.type !== 'patient') {
        throw new HttpException(
          'Only patients can create broadcasts',
          HttpStatus.FORBIDDEN,
        );
      }

      // Create the broadcast
      const broadcast = await this.prisma.broadcast.create({
        data: {
          patient_id: patientId,
          message: createBroadcastDto.message,
          status: 'open', // Default status is "open"
        },
        select: {
          id: true,
          patient_id: true,
          message: true,
          status: true,
          created_at: true,
          updated_at: true,
          patient: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
            },
          },
        },
      });

      // Add avatar URL if exists
      if (broadcast.patient.avatar) {
        broadcast.patient['avatar_url'] = SojebStorage.url(
          appConfig().storageUrl.avatar + broadcast.patient.avatar,
        );
      }

      // Get all verified doctors to notify them about the new broadcast
      const doctors = await this.prisma.user.findMany({
        where: {
          type: 'doctor',
          approved_at: {
            not: null, // Only verified doctors
          },
          deleted_at: null, // Only active doctors
        },
        select: {
          id: true,
        },
      });

      // Notify all doctors via WebSocket about the new broadcast
      doctors.forEach((doctor) => {
        this.messageGateway.server.to(doctor.id).emit('new_broadcast', {
          broadcast: broadcast,
        });
      });

      return {
        success: true,
        message: 'Broadcast created successfully and sent to all doctors',
        data: broadcast,
      };
    } catch (error) {
      // Handle known errors
      if (error instanceof HttpException) {
        throw error;
      }

      // Handle database errors
      if (error.code === 'P2002') {
        throw new HttpException(
          'A broadcast with this information already exists',
          HttpStatus.CONFLICT,
        );
      }

      // Handle other errors
      throw new HttpException(
        error.message || 'Failed to create broadcast',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Find all broadcasts for a patient
   * Patients can view their own broadcasts
   * @param patientId - The ID of the patient
   * @returns List of broadcasts created by the patient
   */
  async findAllByPatient(patientId: string): Promise<any> {
    try {
      // Validate that the user is a patient
      const patient = await this.prisma.user.findUnique({
        where: { id: patientId },
        select: {
          id: true,
          type: true,
        },
      });

      if (!patient) {
        throw new HttpException('Patient not found', HttpStatus.NOT_FOUND);
      }

      if (patient.type !== 'patient') {
        throw new HttpException(
          'Only patients can view their broadcasts',
          HttpStatus.FORBIDDEN,
        );
      }

      // Get all broadcasts for this patient
      const broadcasts = await this.prisma.broadcast.findMany({
        where: {
          patient_id: patientId,
          deleted_at: null, // Only non-deleted broadcasts
        },
        orderBy: {
          created_at: 'desc', // Most recent first
        },
        select: {
          id: true,
          patient_id: true,
          message: true,
          status: true,
          assisted_by: true,
          conversation_id: true,
          created_at: true,
          updated_at: true,
          patient: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
        },
      });

      // Add avatar URLs
      broadcasts.forEach((broadcast) => {
        if (broadcast.patient.avatar) {
          broadcast.patient['avatar_url'] = SojebStorage.url(
            appConfig().storageUrl.avatar + broadcast.patient.avatar,
          );
        }
      });

      return {
        success: true,
        data: broadcasts,
      };
    } catch (error) {
      // Handle known errors
      if (error instanceof HttpException) {
        throw error;
      }

      // Handle other errors
      throw new HttpException(
        error.message || 'Failed to fetch broadcasts',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Find all open broadcasts for doctors
   * Doctors can view all open broadcasts in their inbox
   * @returns List of all open broadcasts
   */
  async findAllOpenForDoctors(): Promise<any> {
    try {
      // Get all open broadcasts (not assisted yet)
      const broadcasts = await this.prisma.broadcast.findMany({
        where: {
          status: 'open', // Only open broadcasts
          deleted_at: null, // Only non-deleted broadcasts
        },
        orderBy: {
          created_at: 'desc', // Most recent first
        },
        select: {
          id: true,
          patient_id: true,
          message: true,
          status: true,
          assisted_by: true,
          conversation_id: true,
          created_at: true,
          updated_at: true,
          patient: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
            },
          },
        },
      });

      // Add avatar URLs
      broadcasts.forEach((broadcast) => {
        if (broadcast.patient.avatar) {
          broadcast.patient['avatar_url'] = SojebStorage.url(
            appConfig().storageUrl.avatar + broadcast.patient.avatar,
          );
        }
      });

      return {
        success: true,
        data: broadcasts,
      };
    } catch (error) {
      // Handle database errors
      throw new HttpException(
        error.message || 'Failed to fetch broadcasts',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Find a single broadcast by ID
   * @param id - The ID of the broadcast
   * @returns The broadcast with patient information
   */
  async findOne(id: string): Promise<any> {
    try {
      const broadcast = await this.prisma.broadcast.findUnique({
        where: { id },
        select: {
          id: true,
          patient_id: true,
          message: true,
          status: true,
          assisted_by: true,
          conversation_id: true,
          created_at: true,
          updated_at: true,
          patient: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
            },
          },
        },
      });

      if (!broadcast) {
        throw new HttpException('Broadcast not found', HttpStatus.NOT_FOUND);
      }

      // Add avatar URL if exists
      if (broadcast.patient.avatar) {
        broadcast.patient['avatar_url'] = SojebStorage.url(
          appConfig().storageUrl.avatar + broadcast.patient.avatar,
        );
      }

      return {
        success: true,
        data: broadcast,
      };
    } catch (error) {
      // Handle known errors
      if (error instanceof HttpException) {
        throw error;
      }

      // Handle other errors
      throw new HttpException(
        error.message || 'Failed to fetch broadcast',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Update a broadcast
   * Used when a doctor responds (status changes to "assisted")
   * @param id - The ID of the broadcast
   * @param updateBroadcastDto - The update data (status, assisted_by, conversation_id)
   * @returns Updated broadcast
   */
  async update(
    id: string,
    updateBroadcastDto: UpdateBroadcastDto,
  ): Promise<any> {
    try {
      // Check if broadcast exists
      const existingBroadcast = await this.prisma.broadcast.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          assisted_by: true,
          conversation_id: true,
        },
      });

      if (!existingBroadcast) {
        throw new HttpException('Broadcast not found', HttpStatus.NOT_FOUND);
      }

      // Prevent updating if broadcast is already assisted (race condition protection)
      // This is a safety check in case two doctors try to respond simultaneously
      if (
        updateBroadcastDto.status === 'assisted' &&
        existingBroadcast.status === 'assisted' &&
        existingBroadcast.assisted_by !== updateBroadcastDto.assisted_by
      ) {
        throw new HttpException(
          'This broadcast has already been assisted by another doctor',
          HttpStatus.CONFLICT,
        );
      }

      // Prepare update data
      const updateData: any = {
        updated_at: DateHelper.now(),
      };

      if (updateBroadcastDto.status !== undefined) {
        updateData.status = updateBroadcastDto.status;
      }

      if (updateBroadcastDto.assisted_by !== undefined) {
        updateData.assisted_by = updateBroadcastDto.assisted_by;
      }

      if (updateBroadcastDto.conversation_id !== undefined) {
        updateData.conversation_id = updateBroadcastDto.conversation_id;
      }

      // Update the broadcast
      const updatedBroadcast = await this.prisma.broadcast.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          patient_id: true,
          message: true,
          status: true,
          assisted_by: true,
          conversation_id: true,
          created_at: true,
          updated_at: true,
          patient: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
        },
      });

      // Add avatar URL if exists
      if (updatedBroadcast.patient.avatar) {
        updatedBroadcast.patient['avatar_url'] = SojebStorage.url(
          appConfig().storageUrl.avatar + updatedBroadcast.patient.avatar,
        );
      }

      // Notify all doctors via WebSocket that this broadcast has been assisted
      const doctors = await this.prisma.user.findMany({
        where: {
          type: 'doctor',
          approved_at: {
            not: null, // Only verified doctors
          },
          deleted_at: null, // Only active doctors
        },
        select: {
          id: true,
        },
      });

      // Notify all doctors about the updated broadcast status
      doctors.forEach((doctor) => {
        this.messageGateway.server.to(doctor.id).emit('broadcast_updated', {
          broadcast: updatedBroadcast,
        });
      });

      // Notify the patient about the update
      this.messageGateway.server
        .to(updatedBroadcast.patient_id)
        .emit('broadcast_updated', {
          broadcast: updatedBroadcast,
        });

      return {
        success: true,
        message: 'Broadcast updated successfully',
        data: updatedBroadcast,
      };
    } catch (error) {
      // Handle known errors
      if (error instanceof HttpException) {
        throw error;
      }

      // Handle database errors
      if (error.code === 'P2025') {
        throw new HttpException('Broadcast not found', HttpStatus.NOT_FOUND);
      }

      // Handle other errors
      throw new HttpException(
        error.message || 'Failed to update broadcast',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Remove a broadcast (soft delete)
   * @param id - The ID of the broadcast
   * @returns Success message
   */
  async remove(id: string): Promise<any> {
    try {
      // Check if broadcast exists
      const existingBroadcast = await this.prisma.broadcast.findUnique({
        where: { id },
      });

      if (!existingBroadcast) {
        throw new HttpException('Broadcast not found', HttpStatus.NOT_FOUND);
      }

      // Soft delete the broadcast
      await this.prisma.broadcast.update({
        where: { id },
        data: {
          deleted_at: DateHelper.now(),
        },
      });

      return {
        success: true,
        message: 'Broadcast deleted successfully',
      };
    } catch (error) {
      // Handle known errors
      if (error instanceof HttpException) {
        throw error;
      }

      // Handle database errors
      if (error.code === 'P2025') {
        throw new HttpException('Broadcast not found', HttpStatus.NOT_FOUND);
      }

      // Handle other errors
      throw new HttpException(
        error.message || 'Failed to delete broadcast',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
