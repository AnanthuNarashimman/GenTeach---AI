import { MessageCircle } from 'lucide-react';
import '../Styles/ComponentStyles/FloatingButton.css';
import { useNavigate } from 'react-router-dom';

function ChatButton() {
    const navigate = useNavigate();
  return (
    <div className="chatButton floatButton" onClick={() => {navigate('/chat')}}>
        <MessageCircle size={28} color='white' />
    </div>
  )
}

export default ChatButton
