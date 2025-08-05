import CollectionCard from '../Components/CollectionCard.jsx';
import Navbar from '../Components/Navbar.jsx';
import '../Styles/PageStyles/CollectionPage.css';
import ChatButton from '../Components/ChatButton.jsx';
import BackButton from '../Components/BackButton.jsx';

function CollectionPage() {
    return (
        <>
            <BackButton className='back_button'/>
            <div className="collectionPage">
                <Navbar />
                <h1 className="collection-head">Collections</h1>
                <CollectionCard style={{ marginRight: '2%' }} />
            </div>
            <ChatButton />
        </>
    )
}


export default CollectionPage
