import { FolderOpen } from "lucide-react";
import { useNavigate } from "react-router-dom";

function GalleryButton() {
  const navigate = useNavigate();
  return (
    <div className="galleryButton floatButton" onClick={() => {navigate('/collection')}}>
        <FolderOpen size={28} color="white" />
    </div>
  )
}

export default GalleryButton
