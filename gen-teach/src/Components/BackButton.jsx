import { ArrowLeft } from 'lucide-react';

function BackButton() {
    const handleBack = () => {
        window.history.back();
    };

    return (
        <button
            onClick={handleBack}
            style={{
                position: 'fixed',
                top: '4.5%',
                left: '2rem',
                width: '48px',
                height: '48px',
                background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                border: 'none',
                borderRadius: '50%',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                transition: 'all 0.3s ease',
                zIndex: 1000
            }}
            onMouseEnter={(e) => {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 8px 20px rgba(59, 130, 246, 0.4)';
            }}
            onMouseLeave={(e) => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
            }}
        >
            <ArrowLeft size={20} />
        </button>
    );
}

export default BackButton
