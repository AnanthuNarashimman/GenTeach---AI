import '../Styles/ComponentStyles/CollectionCard.css';
import Audio from '../assets/Images/Audio.svg';
import VideO from '../assets/Images/Video.svg';
import Script from '../assets/Images/Script.svg';
import Article from '../assets/Images/Article.svg';

import { useNavigate } from 'react-router-dom';

function CollectionCard() {
  const navigate = useNavigate();
  const collections = [
    {
      title: "Audio Collection",
      description: "Explore your library of AI-generated audio content, podcasts, and voice-guided learning materials.",
      buttonText: "Listen Now",
      img: Audio,
      navigateRoute: '/audio-gallery'
    },
    {
      title: "Video Collection",
      description: "Access your curated collection of engaging video tutorials, visual explanations, and interactive learning experiences.",
      buttonText: "Watch Now",
      img: VideO,
      navigateRoute: '/video-gallery'
    },
    {
      title: "Script Collection",
      description: "Browse through comprehensive scripts, study guides, and detailed written materials for in-depth learning.",
      buttonText: "Read Now",
      img: Script,
      navigateRoute: '/script-gallery'
    },
    {
      title: "Article of the Week",
      description: "Discover handpicked trending articles and insights to expand your knowledge and stay updated with latest topics.",
      buttonText: "Explore",
      img: Article
    }
  ];

  return (
    <div className="collections-container">
      {collections.map((collection, index) => (
        <div key={index} className="collectioncard">
          <div className="col-textarea">
            <h1>{collection.title}</h1>
            <p>{collection.description}</p>
            <button  onClick={() => navigate(collection.navigateRoute)}>{collection.buttonText}</button>
          </div>
          <div className="col-imgarea">
            <img src={collection.img} alt={collection.title} />
          </div>
        </div>
      ))}
    </div>
  )
}

export default CollectionCard;