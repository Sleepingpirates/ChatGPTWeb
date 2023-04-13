import { useState, useRef, useEffect } from "react";
import ChatInput from "~/components/inputs/chatInput";
import MessageList from "~/components/surfaces/messageList";
import Sidebar from "../components/Sidebar";
import { api } from "~/utils/api";
import { type messages, type chat, Role } from "@prisma/client";
import { useSession } from "next-auth/react";
import { type Messages } from "~/types/message.types";
import { toast } from "react-hot-toast";
import { getDefaultModel } from "~/lib/models/getModels";
export default function Home() {
  const { data } = useSession();
  const [currentChat, setCurrentChat] = useState<chat | null>(null);
  const [error, setError] = useState<boolean>(false);
  const [messages, setMessages] = useState<Messages[]>([]);
  const chats = api.chatRouter.getChats.useInfiniteQuery(
    {
      limit: 18,
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      // initialCursor: 1, // <-- optional you can pass an initialCursor
    }
  );

  const tokens = api.settingsRouter.getTokens.useQuery();

  const getMessages = api.chatRouter.getMessages.useMutation({
    onSuccess: (data) => {
      console.log(data);
      if (data) {
        const newMessages = data.map((message) => {
          return {
            role: message.role,
            content: message.message,
          };
        });
        setMessages(newMessages);
      } else {
        setMessages([]);
      }
    },
    onError: (error) => {
      toast.error("Something went wrong.");
    },
  });

  const handleChatChange = (chat: chat | null) => {
    setCurrentChat(chat);
    if (chat)
      getMessages.mutate({
        chatId: chat.id,
      });
    else setMessages([]);
  };

  const getGptResponse = api.chatRouter.getGptResponse.useMutation({
    onSuccess: (data) => {
      setMessages((messages) => {
        if (messages) {
          return [...messages, data.gpt];
        } else {
          return [data.gpt];
        }
      });
      if (data.chat) setCurrentChat(data.chat);
      void chats.refetch();
      void tokens.refetch();
    },
    onError: (error) => {
      toast.error(error.message);
      setError(true);
    },
  });

  const messageListRef = useRef<HTMLDivElement>(null);

  const handleSendMessage = (message: string) => {
    if (message.trim && message.trim() !== "") {
      const newMessage = {
        role: Role.user,
        content: message,
      };

      setMessages((messages) => {
        if (messages) {
          return [...messages, newMessage];
        } else {
          return [newMessage];
        }
      });

      getGptResponse.mutate({
        messages: [...messages, newMessage],
        chatId: currentChat?.id,
        model: getDefaultModel(),
      });

      // Scroll the message list to the bottom
      if (messageListRef.current) {
        messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
      }
    }
  };

  useEffect(() => {
    if (messageListRef.current) {
      setTimeout(() => {
        if (messageListRef.current)
          messageListRef.current.scrollTop =
            messageListRef.current.scrollHeight;
      }, 100);
    }
  }, [messages]);

  const loadMoreChats = async () => {
    await chats.fetchNextPage();
  };

  return (
    <main className="min-h-screen bg-black">
      <div className="mx-auto h-screen">
        <div className="flex h-full">
          <Sidebar
            currentChat={currentChat}
            loadMoreChats={loadMoreChats}
            isFetchingNextPage={chats.isFetchingNextPage}
            pages={chats.data && chats.data.pages ? chats.data.pages : []}
            onChatChange={handleChatChange}
            isGptLoading={getGptResponse.isLoading}
            isLoading={chats.isLoading}
            totalGpt3tokens={tokens.data?._sum?.totalGpt3tokens || 0}
            totalGpt4tokens={tokens.data?._sum?.totalGpt4tokens || 0}
            totalTokens={tokens.data?._sum?.totalTokens}
          />
          <div className="mx-auto flex w-full flex-col py-2 px-2 md:w-4/6">
            <div
              ref={messageListRef}
              className="message-list mb-4 flex-grow overflow-y-auto"
            >
              <MessageList
                messages={messages}
                isLoading={getMessages.isLoading}
                isTyping={getGptResponse.isLoading}
              />
            </div>
            <div className="flex-shrink-0">
              <ChatInput
                onSubmit={handleSendMessage}
                isLoading={getGptResponse.isLoading}
                isError={error}
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
