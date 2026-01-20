import { useState, useRef, useEffect } from "react";
import { MessageSquare, Send, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

type ChatMessage = {
  id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  is_read: boolean;
  created_at: string;
};

export function AdminChat() {
  const { user, isAdmin } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Fetch admin users (for staff to send messages to)
  const { data: adminUsers } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");
      if (error) throw error;
      return data;
    },
    enabled: !isAdmin && !!user,
  });

  // For admins: fetch staff who have messaged
  const { data: chatStaff } = useQuery({
    queryKey: ["chat-staff"],
    queryFn: async () => {
      if (!user) return [];
      
      const { data: messages, error } = await supabase
        .from("chat_messages")
        .select("sender_id, receiver_id")
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);
      
      if (error) throw error;
      
      // Get unique staff IDs who have chatted with this admin
      const staffIds = new Set<string>();
      messages?.forEach(m => {
        if (m.sender_id !== user.id) staffIds.add(m.sender_id);
        if (m.receiver_id !== user.id) staffIds.add(m.receiver_id);
      });
      
      if (staffIds.size === 0) return [];
      
      const { data: staffMembers, error: staffError } = await supabase
        .from("staff_members")
        .select("id, name, user_id")
        .in("user_id", Array.from(staffIds));
      
      if (staffError) throw staffError;
      return staffMembers || [];
    },
    enabled: isAdmin && !!user,
  });

  // Get receiver ID based on role
  const getReceiverId = () => {
    if (isAdmin && selectedStaffId) {
      const staff = chatStaff?.find(s => s.id === selectedStaffId);
      return staff?.user_id;
    }
    return adminUsers?.[0]?.user_id;
  };

  const receiverId = getReceiverId();

  // Fetch messages
  const { data: messages = [], isLoading: loadingMessages } = useQuery({
    queryKey: ["chat-messages", user?.id, receiverId],
    queryFn: async () => {
      if (!user || !receiverId) return [];
      
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .or(
          `and(sender_id.eq.${user.id},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${user.id})`
        )
        .order("created_at", { ascending: true });
      
      if (error) throw error;
      return data as ChatMessage[];
    },
    enabled: !!user && !!receiverId,
    refetchInterval: isOpen ? 3000 : false,
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      if (!user || !receiverId) throw new Error("Cannot send message");
      
      const { error } = await supabase
        .from("chat_messages")
        .insert({
          sender_id: user.id,
          receiver_id: receiverId,
          message,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-messages"] });
      setInput("");
    },
    onError: (error) => {
      toast.error("Failed to send message");
      console.error(error);
    },
  });

  // Subscribe to realtime messages
  useEffect(() => {
    if (!user || !isOpen) return;

    const channel = supabase
      .channel("chat-messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["chat-messages"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, isOpen, queryClient]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || sendMessageMutation.isPending) return;
    sendMessageMutation.mutate(input.trim());
  };

  const noAdminAvailable = !isAdmin && (!adminUsers || adminUsers.length === 0);

  return (
    <>
      {/* Floating button */}
      <Button
        onClick={() => setIsOpen(!isOpen)}
        variant="outline"
        className={cn(
          "fixed bottom-20 left-4 z-50 h-14 w-14 rounded-full shadow-lg",
          isOpen && "hidden"
        )}
        size="icon"
      >
        <MessageSquare className="h-6 w-6" />
      </Button>

      {/* Chat panel */}
      {isOpen && (
        <div className="fixed bottom-20 left-4 z-50 w-[350px] max-w-[calc(100vw-2rem)] rounded-lg border bg-background shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b p-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              <span className="font-semibold">
                {isAdmin ? "Staff Messages" : "Chat with Admin"}
              </span>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Admin: Staff selector */}
          {isAdmin && (
            <div className="border-b p-2">
              <select
                value={selectedStaffId || ""}
                onChange={(e) => setSelectedStaffId(e.target.value || null)}
                className="w-full rounded border bg-background p-2 text-sm"
              >
                <option value="">Select staff member</option>
                {chatStaff?.map((staff) => (
                  <option key={staff.id} value={staff.id}>
                    {staff.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Messages */}
          <ScrollArea className="h-[300px] p-3" ref={scrollRef}>
            {noAdminAvailable ? (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                <p className="text-sm text-center">No admin available for chat yet.</p>
              </div>
            ) : isAdmin && !selectedStaffId ? (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                <p className="text-sm text-center">Select a staff member to view messages</p>
              </div>
            ) : loadingMessages ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                <p className="text-sm text-center">No messages yet. Start a conversation!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((msg) => (
                  <div key={msg.id}>
                    <div
                      className={cn(
                        "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                        msg.sender_id === user?.id
                          ? "ml-auto bg-primary text-primary-foreground"
                          : "bg-muted"
                      )}
                    >
                      {msg.message}
                    </div>
                    <p
                      className={cn(
                        "mt-1 text-xs text-muted-foreground",
                        msg.sender_id === user?.id && "text-right"
                      )}
                    >
                      {format(new Date(msg.created_at), "HH:mm")}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Input */}
          <div className="border-t p-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex gap-2"
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={noAdminAvailable ? "No admin available" : "Type a message..."}
                disabled={sendMessageMutation.isPending || noAdminAvailable || (isAdmin && !selectedStaffId)}
                className="flex-1"
              />
              <Button
                type="submit"
                size="icon"
                disabled={
                  sendMessageMutation.isPending ||
                  !input.trim() ||
                  noAdminAvailable ||
                  (isAdmin && !selectedStaffId)
                }
              >
                {sendMessageMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
