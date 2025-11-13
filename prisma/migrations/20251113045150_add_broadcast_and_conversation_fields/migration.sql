-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "assisted_by" TEXT,
ADD COLUMN     "broadcast_id" TEXT,
ADD COLUMN     "status" TEXT DEFAULT 'open',
ADD COLUMN     "type" TEXT DEFAULT 'patient_doctor';

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "medicine_details" TEXT,
ADD COLUMN     "message_type" TEXT DEFAULT 'text',
ADD COLUMN     "patient_name" TEXT;

-- CreateTable
CREATE TABLE "broadcasts" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    "patient_id" TEXT NOT NULL,
    "message" TEXT,
    "status" TEXT DEFAULT 'open',
    "assisted_by" TEXT,
    "conversation_id" TEXT,

    CONSTRAINT "broadcasts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "broadcasts_status_idx" ON "broadcasts"("status");

-- CreateIndex
CREATE INDEX "broadcasts_patient_id_idx" ON "broadcasts"("patient_id");

-- CreateIndex
CREATE INDEX "broadcasts_created_at_idx" ON "broadcasts"("created_at");

-- CreateIndex
CREATE INDEX "broadcasts_assisted_by_idx" ON "broadcasts"("assisted_by");

-- CreateIndex
CREATE INDEX "conversations_status_idx" ON "conversations"("status");

-- CreateIndex
CREATE INDEX "conversations_type_idx" ON "conversations"("type");

-- CreateIndex
CREATE INDEX "conversations_broadcast_id_idx" ON "conversations"("broadcast_id");

-- CreateIndex
CREATE INDEX "conversations_assisted_by_idx" ON "conversations"("assisted_by");

-- CreateIndex
CREATE INDEX "messages_message_type_idx" ON "messages"("message_type");

-- CreateIndex
CREATE INDEX "messages_conversation_id_idx" ON "messages"("conversation_id");

-- AddForeignKey
ALTER TABLE "broadcasts" ADD CONSTRAINT "broadcasts_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
