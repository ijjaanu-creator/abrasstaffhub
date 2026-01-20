-- Create chat messages table for staff-admin private chat
CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL,
  receiver_id UUID NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see messages they sent or received
CREATE POLICY "Users can view their own messages"
ON public.chat_messages
FOR SELECT
USING (
  auth.uid() = sender_id OR auth.uid() = receiver_id
);

-- Policy: Users can send messages
CREATE POLICY "Users can send messages"
ON public.chat_messages
FOR INSERT
WITH CHECK (auth.uid() = sender_id);

-- Policy: Users can mark messages as read if they are the receiver
CREATE POLICY "Users can mark messages as read"
ON public.chat_messages
FOR UPDATE
USING (auth.uid() = receiver_id);

-- Enable realtime for chat messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;

-- Create AI chat history table for staff AI assistant
CREATE TABLE public.ai_chat_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_chat_history ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own AI chat history
CREATE POLICY "Users can view their own AI chat"
ON public.ai_chat_history
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Users can insert their own AI chat
CREATE POLICY "Users can insert their own AI chat"
ON public.ai_chat_history
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own AI chat history
CREATE POLICY "Users can delete their own AI chat"
ON public.ai_chat_history
FOR DELETE
USING (auth.uid() = user_id);