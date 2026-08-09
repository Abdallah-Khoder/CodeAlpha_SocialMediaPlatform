import { useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import MessagesSidebar from "../components/MessagesSidebar";
import ChatWindow from "../components/ChatWindow";
import "../styles/messages.css";
import "../styles/pageTransition.css"; 

function Messages() {
  const { conversationId } = useParams();

  return (
    <div className="page-fade-in">
      <Navbar />
      <div className="messages-layout">
        <div className="messages-sidebar">
          <MessagesSidebar activeConversationId={conversationId} />
        </div>

        <div className="messages-main">
          {conversationId ? (
            <ChatWindow conversationId={conversationId} key={conversationId} />
          ) : (
            <div className="messages-empty-state">Select someone to start chatting.</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Messages;