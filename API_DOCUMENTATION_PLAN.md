# API Documentation Restructure Plan

## Overview
This plan outlines how to restructure the API documentation into a story-driven, frontend-friendly format that explains user actions, page flows, and API call sequences.

---

## 1. Document Structure

### 1.1 Introduction Section
- **Characters Introduction**: Introduce all actors with their roles
  - Sarah (Patient) - Main patient character
  - Sam (Doctor 1) - First responding doctor
  - Parker (Doctor 2) - Second doctor (to show competition scenario)
  - Daniel (Shop Owner 1) - Medicine shop owner
  - Dollar (Shop Owner 2) - Second shop owner
  - Admin - Platform administrator

- **Platform Overview**: Brief explanation of the platform flow
- **Story Timeline**: Overview of the complete story flow

### 1.2 Quick Reference Section
- **API Endpoints Table**: Quick lookup table for all endpoints
- **WebSocket Events Table**: Quick reference for all WebSocket events
- **Error Codes**: Common error responses

---

## 2. Story-Based Sections

### 2.1 Act 1: Onboarding & Setup
**Story Context**: Users register and get verified

#### 2.1.1 Registration Flow
- **Sarah (Patient) registers**
  - User Action: Sarah fills registration form
  - Frontend Action: Show registration page
  - API Called: `POST /auth/register` (type: "patient")
  - What Happens: Sarah is immediately registered (no approval needed)
  - Next Step: Sarah can login and use the platform

- **Sam (Doctor) registers**
  - User Action: Sam fills registration form as doctor
  - Frontend Action: Show registration page with role selection
  - API Called: `POST /auth/register` (type: "doctor")
  - What Happens: Sam is registered but needs admin approval
  - Frontend Behavior: Show "Pending Approval" message
  - Next Step: Admin needs to approve Sam

- **Daniel (Shop Owner) registers**
  - User Action: Daniel fills registration form as shop owner
  - Frontend Action: Show registration page with role selection
  - API Called: `POST /auth/register` (type: "shop_owner")
  - What Happens: Daniel is registered but needs admin approval
  - Frontend Behavior: Show "Pending Approval" message
  - Next Step: Admin needs to approve Daniel

#### 2.1.2 Admin Verification Flow
- **Admin views pending verifications**
  - User Action: Admin logs in and navigates to verification dashboard
  - Frontend Action: Load verification page
  - API Called: `GET /admin/user/verifications/pending`
  - What Happens: Admin sees list of Sam and Daniel waiting for approval
  - Frontend Behavior: Display pending users with approve/reject buttons

- **Admin approves Sam (Doctor)**
  - User Action: Admin clicks "Approve" for Sam
  - Frontend Action: Send approval request
  - API Called: `POST /admin/user/:id/approve`
  - What Happens: Sam's `approved_at` is set, he can now view broadcasts
  - Frontend Behavior: Update UI to show Sam as approved
  - Next Step: Sam can now login and see patient broadcasts

- **Admin approves Daniel (Shop Owner)**
  - User Action: Admin clicks "Approve" for Daniel
  - Frontend Action: Send approval request
  - API Called: `POST /admin/user/:id/approve`
  - What Happens: Daniel's `approved_at` is set, he can receive prescriptions
  - Frontend Behavior: Update UI to show Daniel as approved
  - Next Step: Daniel can now login and receive prescriptions

---

### 2.2 Act 2: Patient Creates Broadcast
**Story Context**: Sarah needs medical help and creates a broadcast

#### 2.2.1 Sarah's Dashboard (Patient View)
- **Page Load Sequence**
  1. User Action: Sarah logs in and navigates to dashboard
  2. Frontend Action: Load patient dashboard
  3. API Called: `GET /chat/broadcast/patient` (Get Sarah's broadcasts)
  4. What Happens: Frontend receives list of Sarah's broadcasts
  5. Frontend Behavior: Display broadcasts with status (open, assisted, closed)
  6. WebSocket: Connect to WebSocket server with JWT token
  7. WebSocket Event: Listen for `broadcast_updated` events

#### 2.2.2 Sarah Creates Broadcast
- **User Flow**
  1. User Action: Sarah clicks "Create Broadcast" or "Ask for Help"
  2. Frontend Action: Show broadcast creation form
  3. User Action: Sarah types her medical issue: "I have a severe headache and fever"
  4. User Action: Sarah clicks "Send" or "Broadcast"
  5. Frontend Action: Send broadcast request
  6. API Called: `POST /chat/broadcast`
     - Request Body: `{ "message": "I have a severe headache and fever." }`
  7. What Happens: 
     - Broadcast is created with status "open"
     - Broadcast is immediately visible to all verified doctors
     - WebSocket event `broadcast_updated` is emitted to all doctors
  8. Frontend Behavior: 
     - Show success message
     - Update broadcast list
     - Show broadcast status as "open"
     - Display "Waiting for doctor response" message
  9. Next Step: Wait for doctor to respond

---

### 2.3 Act 3: Doctors View Broadcasts
**Story Context**: Sam and Parker see Sarah's broadcast

#### 2.3.1 Sam's Inbox (Doctor View)
- **Page Load Sequence**
  1. User Action: Sam logs in and navigates to inbox
  2. Frontend Action: Load doctor inbox page
  3. API Called: `GET /chat/broadcast/inbox` (Get open broadcasts)
  4. What Happens: Frontend receives list of all open broadcasts
  5. Frontend Behavior: 
     - Display list of open broadcasts
     - Show patient name, message, and timestamp
     - Show "Respond" button for each broadcast
  6. WebSocket: Connect to WebSocket server
  7. WebSocket Event: Listen for `broadcast_updated` events (to see when broadcasts are assisted)

#### 2.3.2 Sam Views Sarah's Broadcast
- **User Flow**
  1. User Action: Sam sees Sarah's broadcast in his inbox
  2. Frontend Action: Display broadcast card with patient info
  3. User Action: Sam clicks on broadcast to view details
  4. Frontend Action: Show broadcast details modal/page
  5. API Called: `GET /chat/broadcast/:id` (Get broadcast details)
  6. What Happens: Frontend receives full broadcast details including patient info
  7. Frontend Behavior: Display broadcast message and patient information
  8. Next Step: Sam can respond to the broadcast

#### 2.3.3 Parker Also Sees Sarah's Broadcast
- **User Flow**
  1. User Action: Parker logs in and navigates to inbox
  2. Frontend Action: Load doctor inbox page
  3. API Called: `GET /chat/broadcast/inbox`
  4. What Happens: Parker also sees Sarah's broadcast
  5. Frontend Behavior: Display broadcast in Parker's inbox
  6. Note: Both Sam and Parker can see the same broadcast (competition scenario)

---

### 2.4 Act 4: Doctor Responds to Broadcast
**Story Context**: Sam responds first, creating a private conversation

#### 2.4.1 Sam Responds to Sarah's Broadcast
- **User Flow**
  1. User Action: Sam clicks "Respond" button on Sarah's broadcast
  2. Frontend Action: Show confirmation dialog or directly respond
  3. User Action: Sam confirms response
  4. Frontend Action: Send response request
  5. API Called: `POST /chat/conversation/broadcast/:broadcastId/respond`
     - URL: `/chat/conversation/broadcast/clx1234567890/respond`
  6. What Happens:
     - System checks if broadcast is still open
     - Creates private conversation between Sam and Sarah
     - Updates broadcast status to "assisted"
     - Sets `assisted_by` to Sam's ID
     - Links conversation to broadcast
     - WebSocket event `broadcast_updated` is emitted to all doctors
     - WebSocket event `new_conversation` is emitted to Sarah
  7. Frontend Behavior:
     - Show success message
     - Redirect to conversation page
     - Update broadcast status in UI
  8. Next Step: Conversation page loads

#### 2.4.2 Parker Tries to Respond (Too Late)
- **User Flow**
  1. User Action: Parker clicks "Respond" on Sarah's broadcast
  2. Frontend Action: Send response request
  3. API Called: `POST /chat/conversation/broadcast/:broadcastId/respond`
  4. What Happens:
     - System checks broadcast status
     - Broadcast is already "assisted" by Sam
     - Returns error: "This broadcast has already been assisted by another doctor"
  5. Frontend Behavior:
     - Show error message
     - Update broadcast status in inbox to show "Already assisted"
     - Disable "Respond" button
  6. Next Step: Parker can't respond to this broadcast

#### 2.4.3 Broadcast Status Updates for All Doctors
- **Real-time Update Flow**
  1. WebSocket Event: `broadcast_updated` is received by all doctors
  2. Event Data: 
     ```json
     {
       "broadcast_id": "clx1234567890",
       "status": "assisted",
       "assisted_by": "sam_doctor_id",
       "conversation_id": "clxconv123"
     }
     ```
  3. Frontend Behavior:
     - Update broadcast status in inbox
     - Show "Already assisted" badge
     - Disable "Respond" button
     - Remove broadcast from open broadcasts list (optional)

---

### 2.5 Act 5: Private Conversation Begins
**Story Context**: Sarah and Sam start chatting in private conversation

#### 2.5.1 Sarah's Conversation Page Loads
- **Page Load Sequence**
  1. User Action: Sarah receives notification or navigates to conversations
  2. Frontend Action: Load conversation list page
  3. API Called: `GET /chat/conversation` (Get all conversations)
  4. What Happens: Frontend receives list of Sarah's conversations
  5. Frontend Behavior: Display conversations with last message preview
  6. User Action: Sarah clicks on conversation with Sam
  7. Frontend Action: Load conversation detail page
  8. API Called: `GET /chat/conversation/:id` (Get conversation details)
  9. What Happens: Frontend receives conversation details with messages
  10. Frontend Behavior: Display conversation messages
  11. WebSocket: Join conversation room
  12. WebSocket Event: `joinRoom` with `room_id: conversation_id`

#### 2.5.2 Sam's Conversation Page Loads
- **Page Load Sequence**
  1. User Action: Sam is redirected to conversation after responding
  2. Frontend Action: Load conversation detail page
  3. API Called: `GET /chat/conversation/:id` (Get conversation details)
  4. What Happens: Frontend receives conversation details
  5. Frontend Behavior: Display conversation with Sarah
  6. WebSocket: Join conversation room
  7. WebSocket Event: `joinRoom` with `room_id: conversation_id`

#### 2.5.3 Sam Sends First Message
- **User Flow**
  1. User Action: Sam types message: "Hello Sarah, I see you have a headache and fever. Can you tell me more about your symptoms?"
  2. User Action: Sam clicks "Send"
  3. Frontend Action: Send message request
  4. API Called: `POST /chat/message`
     - Request Body:
       ```json
       {
         "receiver_id": "sarah_patient_id",
         "conversation_id": "clxconv123",
         "message": "Hello Sarah, I see you have a headache and fever. Can you tell me more about your symptoms?",
         "message_type": "text"
       }
       ```
  5. What Happens:
     - Message is created and saved to database
     - Conversation `updated_at` is updated
     - WebSocket event `message` is emitted to conversation room
     - WebSocket event `message` is emitted to Sarah's socket (if online)
  6. Frontend Behavior:
     - Show message in conversation immediately (optimistic update)
     - Mark message as sent
     - Update conversation last message preview
  7. WebSocket Event: Sarah receives `message` event in real-time
  8. Frontend Behavior (Sarah's side): 
     - Show new message in conversation
     - Play notification sound (optional)
     - Show notification badge

#### 2.5.4 Sarah Responds
- **User Flow**
  1. User Action: Sarah receives message and types response
  2. User Action: Sarah clicks "Send"
  3. Frontend Action: Send message request
  4. API Called: `POST /chat/message`
     - Request Body:
       ```json
       {
         "receiver_id": "sam_doctor_id",
         "conversation_id": "clxconv123",
         "message": "The headache started yesterday and the fever began this morning. I also feel nauseous.",
         "message_type": "text"
       }
       ```
  5. What Happens: Same as above (message created, WebSocket events emitted)
  6. Frontend Behavior: Message appears in conversation
  7. WebSocket Event: Sam receives `message` event in real-time

#### 2.5.5 Conversation Continues
- **Message Loading**
  1. User Action: User scrolls up to see older messages
  2. Frontend Action: Load more messages (pagination)
  3. API Called: `GET /chat/message?conversation_id=clxconv123&limit=20&cursor=last_message_id`
  4. What Happens: Frontend receives older messages
  5. Frontend Behavior: Append messages to conversation view
  6. Note: Cursor-based pagination for efficient loading

---

### 2.6 Act 6: Doctor Creates Prescription
**Story Context**: Sam decides to prescribe medicine for Sarah

#### 2.6.1 Sam Creates Prescription
- **User Flow**
  1. User Action: Sam clicks "Create Prescription" button in conversation
  2. Frontend Action: Show prescription form/modal
  3. User Action: Sam fills prescription form:
     - Patient Name: "Sarah" (auto-populated, non-editable)
     - Medicine Details: "Paracetamol 500mg - 2 tablets, 3 times daily for 5 days"
  4. User Action: Sam clicks "Send Prescription"
  5. Frontend Action: Send prescription request
  6. API Called: `POST /chat/message`
     - Request Body:
       ```json
       {
         "receiver_id": "sarah_patient_id",
         "conversation_id": "clxconv123",
         "message": "Prescription",
         "message_type": "prescription",
         "medicine_details": "Paracetamol 500mg - 2 tablets, 3 times daily for 5 days",
         "patient_name": "Sarah"
       }
       ```
  7. What Happens:
     - Prescription message is created in Sarah's conversation
     - Prescription is automatically distributed to all verified shop owners (Daniel and Dollar)
     - For each shop owner:
       - System finds or creates `doctor_shop_owner` conversation
       - Prescription message is created in that conversation
       - WebSocket event `new_prescription` is emitted to shop owner
       - WebSocket event `message` is emitted to shop owner
     - WebSocket event `message` is emitted to Sarah
  8. Frontend Behavior (Sam's side):
     - Show prescription message in conversation
     - Mark message as prescription type
     - Display prescription details in special format
  9. Frontend Behavior (Sarah's side):
     - Receive prescription message in real-time
     - Display prescription in special format
     - Show prescription details prominently
  10. Next Step: Shop owners receive prescription

---

### 2.7 Act 7: Shop Owners Receive Prescriptions
**Story Context**: Daniel and Dollar receive Sarah's prescription

#### 2.7.1 Daniel's Prescription Page Loads
- **Page Load Sequence**
  1. User Action: Daniel logs in and navigates to prescriptions page
  2. Frontend Action: Load prescriptions page
  3. API Called: `GET /chat/shop-owner/prescriptions?limit=20`
  4. What Happens: Frontend receives list of all prescriptions sent to Daniel
  5. Frontend Behavior: Display prescriptions with doctor name, patient name, and medicine details
  6. WebSocket: Connect to WebSocket server
  7. WebSocket Event: Listen for `new_prescription` events

#### 2.7.2 Daniel Receives Prescription in Real-time
- **Real-time Update Flow**
  1. WebSocket Event: Daniel receives `new_prescription` event
  2. Event Data:
     ```json
     {
       "prescription": {
         "id": "clxmsg123",
         "message": "Prescription",
         "message_type": "prescription",
         "medicine_details": "Paracetamol 500mg - 2 tablets, 3 times daily for 5 days",
         "patient_name": "Sarah"
       },
       "doctor": {
         "id": "sam_doctor_id",
         "name": "Dr. Sam"
       }
     }
     ```
  3. Frontend Behavior:
     - Show notification: "New prescription received"
     - Add prescription to prescriptions list
     - Update prescription count badge
     - Play notification sound (optional)
  4. User Action: Daniel clicks on prescription
  5. Frontend Action: Load prescription details
  6. API Called: `GET /chat/shop-owner/prescriptions/:id`
  7. What Happens: Frontend receives full prescription details
  8. Frontend Behavior: Display prescription details with doctor and patient info

#### 2.7.3 Daniel Views Conversation with Sam
- **User Flow**
  1. User Action: Daniel navigates to conversations page
  2. Frontend Action: Load conversations page
  3. API Called: `GET /chat/shop-owner/conversations?limit=20`
  4. What Happens: Frontend receives list of conversations with doctors
  5. Frontend Behavior: Display conversations with last message preview
  6. User Action: Daniel clicks on conversation with Sam
  7. Frontend Action: Load conversation detail page
  8. API Called: `GET /chat/conversation/:id` (Get conversation with Sam)
  9. What Happens: Frontend receives conversation with all prescription messages
  10. Frontend Behavior: Display conversation with prescription messages
  11. Note: Same doctor-shop_owner conversation is reused for all prescriptions from that doctor

#### 2.7.4 Dollar Also Receives Prescription
- **User Flow**
  1. User Action: Dollar logs in and navigates to prescriptions page
  2. Frontend Action: Load prescriptions page
  3. API Called: `GET /chat/shop-owner/prescriptions?limit=20`
  4. What Happens: Dollar also receives Sarah's prescription
  5. Frontend Behavior: Display prescription in Dollar's prescriptions list
  6. Note: All verified shop owners receive all prescriptions

---

### 2.8 Act 8: Admin Monitors System
**Story Context**: Admin views system activities and statistics

#### 2.8.1 Admin Dashboard Loads
- **Page Load Sequence**
  1. User Action: Admin logs in and navigates to dashboard
  2. Frontend Action: Load admin dashboard
  3. API Called: `GET /admin/user/statistics` (Get system statistics)
  4. What Happens: Frontend receives system statistics
  5. Frontend Behavior: Display statistics (user counts, conversation counts, prescription counts, broadcast counts)

#### 2.8.2 Admin Views All Conversations
- **User Flow**
  1. User Action: Admin navigates to conversations page
  2. Frontend Action: Load conversations page
  3. API Called: `GET /admin/user/conversations?limit=20`
  4. What Happens: Frontend receives all conversations in the system
  5. Frontend Behavior: Display all conversations (patient-doctor and doctor-shop_owner)

#### 2.8.3 Admin Views All Prescriptions
- **User Flow**
  1. User Action: Admin navigates to prescriptions page
  2. Frontend Action: Load prescriptions page
  3. API Called: `GET /admin/user/prescriptions?limit=20`
  4. What Happens: Frontend receives all prescriptions in the system
  5. Frontend Behavior: Display all prescriptions with doctor and patient info

#### 2.8.4 Admin Views All Broadcasts
- **User Flow**
  1. User Action: Admin navigates to broadcasts page
  2. Frontend Action: Load broadcasts page
  3. API Called: `GET /admin/user/broadcasts?limit=20`
  4. What Happens: Frontend receives all broadcasts in the system
  5. Frontend Behavior: Display all broadcasts with status and patient info

---

## 3. Detailed API Documentation

### 3.1 For Each API Endpoint, Include:
- **Story Context**: When and why this API is called
- **User Action**: What the user does that triggers this API
- **Frontend Action**: What the frontend does before/after calling the API
- **API Details**: 
  - Method, URL, Headers
  - Request Body (with example data from story)
  - Response Body (with example data from story)
- **WebSocket Events**: What WebSocket events are emitted (if any)
- **Next Steps**: What happens after this API call
- **Error Handling**: What errors can occur and how to handle them
- **Frontend Implementation Notes**: Tips for frontend implementation

### 3.2 WebSocket Events Documentation
- **Event Name**: Event identifier
- **When It's Emitted**: Under what circumstances
- **Who Receives It**: Which users receive this event
- **Event Data**: Payload structure with example data
- **Frontend Handling**: How frontend should handle this event
- **Story Context**: Real example from the story

---

## 4. Frontend Implementation Guide

### 4.1 Page Load Sequences
For each page, document:
- **Initial API Calls**: Which APIs are called on page load
- **Data Loading Order**: Order in which data is loaded
- **WebSocket Setup**: When to connect to WebSocket
- **Event Listeners**: Which WebSocket events to listen for
- **UI Updates**: How to update UI based on API responses

### 4.2 State Management
- **Conversation State**: How to manage conversation state
- **Broadcast State**: How to manage broadcast state
- **Prescription State**: How to manage prescription state
- **User State**: How to manage user state

### 4.3 Real-time Updates
- **WebSocket Connection**: How to establish WebSocket connection
- **Event Handling**: How to handle WebSocket events
- **UI Updates**: How to update UI in real-time
- **Error Handling**: How to handle WebSocket errors

### 4.4 Error Handling
- **API Errors**: How to handle API errors
- **WebSocket Errors**: How to handle WebSocket errors
- **Network Errors**: How to handle network errors
- **User Feedback**: How to show error messages to users

---

## 5. Additional Sections

### 5.1 Edge Cases
- **What if multiple doctors respond simultaneously?**
- **What if a shop owner is not online when prescription is sent?**
- **What if a conversation is deleted?**
- **What if a user is deleted?**

### 5.2 Best Practices
- **API Call Optimization**: How to minimize API calls
- **WebSocket Optimization**: How to optimize WebSocket usage
- **Caching Strategies**: How to cache data
- **Error Recovery**: How to recover from errors

### 5.3 Testing Scenarios
- **Test Data Setup**: How to set up test data
- **Test User Accounts**: Test user credentials
- **Test Flows**: Complete test flows for each user role

---

## 6. Document Format

### 6.1 Story Format
- Use narrative style with characters
- Include user actions and frontend actions
- Show API calls in context
- Explain what happens behind the scenes
- Show WebSocket events in real-time

### 6.2 Code Examples
- Include frontend code examples (JavaScript/TypeScript)
- Show API request/response examples
- Include WebSocket event handling examples
- Provide complete code snippets for common scenarios

### 6.3 Visual Flow Diagrams
- Create flow diagrams for complex scenarios
- Show state transitions
- Illustrate API call sequences
- Display WebSocket event flows

### 6.4 Table of Contents
- Organize by story acts
- Include quick reference sections
- Add index for easy navigation
- Include cross-references

---

## 7. Implementation Checklist

### 7.1 Content Creation
- [ ] Write character introductions
- [ ] Document Act 1: Onboarding & Setup
- [ ] Document Act 2: Patient Creates Broadcast
- [ ] Document Act 3: Doctors View Broadcasts
- [ ] Document Act 4: Doctor Responds to Broadcast
- [ ] Document Act 5: Private Conversation Begins
- [ ] Document Act 6: Doctor Creates Prescription
- [ ] Document Act 7: Shop Owners Receive Prescriptions
- [ ] Document Act 8: Admin Monitors System
- [ ] Create API endpoint details for each endpoint
- [ ] Document WebSocket events
- [ ] Create frontend implementation guide
- [ ] Document edge cases
- [ ] Create testing scenarios

### 7.2 Formatting
- [ ] Add code examples
- [ ] Create flow diagrams
- [ ] Add visual elements
- [ ] Format API documentation
- [ ] Add table of contents
- [ ] Add cross-references

### 7.3 Review
- [ ] Review story flow
- [ ] Verify API documentation accuracy
- [ ] Check WebSocket event documentation
- [ ] Review frontend implementation guide
- [ ] Test code examples
- [ ] Get feedback from frontend team

---

## 8. Expected Outcomes

### 8.1 Frontend Team Benefits
- Clear understanding of when to call each API
- Understanding of user flows and page sequences
- Knowledge of WebSocket event handling
- Guidance on error handling
- Complete implementation examples

### 8.2 Developer Benefits
- Story-driven documentation is easier to understand
- Real-world examples from the story
- Clear API call sequences
- WebSocket event flows
- Frontend implementation guidance

### 8.3 User Benefits
- Better frontend implementation
- Smoother user experience
- Real-time updates working correctly
- Proper error handling
- Complete feature implementation

---

## 9. Timeline

### Phase 1: Planning (Current)
- Create detailed plan
- Get approval from stakeholders
- Define story structure
- Identify all user flows

### Phase 2: Content Creation
- Write story-based documentation
- Document all API endpoints
- Document WebSocket events
- Create frontend implementation guide

### Phase 3: Formatting & Review
- Format documentation
- Add code examples
- Create flow diagrams
- Review and refine

### Phase 4: Finalization
- Get feedback from frontend team
- Make necessary adjustments
- Final review
- Publish documentation

---

## 10. Questions for Approval

1. **Story Structure**: Is the 8-act structure appropriate, or would you prefer a different organization?

2. **Character Names**: Are the character names (Sarah, Sam, Parker, Daniel, Dollar) acceptable, or would you prefer different names?

3. **Detail Level**: How detailed should the frontend implementation guide be? Should it include complete code examples?

4. **Visual Elements**: Should we include flow diagrams and visual elements, or keep it text-based?

5. **Code Examples**: What programming language/framework should we use for code examples? (React, Vue, Angular, vanilla JavaScript, etc.)

6. **WebSocket Examples**: Should we include WebSocket client code examples? (Socket.IO, native WebSocket, etc.)

7. **Testing Section**: How detailed should the testing section be? Should it include test data setup instructions?

8. **Additional Sections**: Are there any additional sections you'd like to include?

---

## Conclusion

This plan provides a comprehensive structure for restructuring the API documentation into a story-driven, frontend-friendly format. The documentation will help the frontend team understand when, why, and how to use each API endpoint, making implementation easier and more efficient.

Please review this plan and provide feedback. Once approved, we can proceed with creating the new documentation.

