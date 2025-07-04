import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

//Font Awesome
import { FontAwesomeModule, FaIconLibrary  } from '@fortawesome/angular-fontawesome';
import {
  faFacebook as faFacebook,
  faGoogle as faGoogle,
  faTwitter as faTwitter,
  faInstagram as faInstagram,
  faYoutube as faYoutube,
  faPinterest as faPinterest
} from '@fortawesome/free-brands-svg-icons';
import {
  faUser as faUser,
  faHeart as faHeart,
  faPaperPlane as faPaperPlane,
  faTrashAlt as faTrashAlt,
  faQuestionCircle as faQuestionCircle,
  faImage as faImage,
  faNewspaper as faNewspaper,
  faFile as faFile,
  faEye as faEye,
  faClone as faClone,
  faCopy as faCopy
} from '@fortawesome/free-regular-svg-icons';
import {
  faLongArrowAltLeft as faLongArrowAltLeft,
  faLongArrowAltRight as faLongArrowAltRight,
  faLongArrowAltUp as faLongArrowAltUp,
  faEllipsisH as faEllipsisH,
  faEllipsisV as faEllipsisV,
  faPlus as faPlus,
  faFileWord as faFileWord,
  faArrowUp as faArrowUp,
  faArrowDown as faArrowDown,
  faHashtag as faHashtag,
  faReply as faReply,
  faLink as faLink,
  faShoppingCart as faShoppingCart,
  faHeart as faSolidHeart,
  faStar as faStar,
  faUserEdit as faUserEdit,
  faUserPlus as faUserPlus,
  faUserMinus as faUserMinus,
  faEyeSlash as faEyeSlash,
  faMapMarkerAlt as faMapPin,
  faShareAlt as faShareAlt,
  faCommentDots as faCommentDots,
  faFire as faFire,
  faWallet,
  faPen,
  faPencilAlt as faPencil,
  faPlusCircle as faPlusCircle,
  faSlidersH as faSliders,
  faUnlockAlt as faUnlockAlt,
  faUnlock as faUnlock,
  faSmile as faSmilePlus,
  faAngleRight as faAngleRight,
  faAngleLeft as faAngleLeft,
  faTimes as faTimes,
  faQuestion as faQuestion,
  faSearch as faSearch,
  faMinus as faMinus,
  faThList as faThList
} from '@fortawesome/free-solid-svg-icons';

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    FontAwesomeModule
  ],
  exports: [FontAwesomeModule]
})
export class FontAwesomeLibraryModule {
  constructor(library: FaIconLibrary) {
    // Add an icon to the library for convenient access in other components
    library.addIcons(
      // Regular icons
      faUser, faHeart, faPaperPlane, faTrashAlt, 
      faQuestionCircle, faImage, faNewspaper, 
      faFile, faEye, faClone, faCopy,
      // Solid icons
      faLongArrowAltLeft, faSmilePlus, faCommentDots, faEllipsisH, faMapPin, faShareAlt, 
      faFire, faPlus, faFileWord, faWallet, faArrowUp, faArrowDown, faHashtag, 
      faReply, faLink, faShoppingCart, faSolidHeart, faStar, faLongArrowAltRight, 
      faLongArrowAltUp, faUserEdit, faUserPlus, faUserMinus, faPlusCircle, 
      faSliders, faEllipsisV, faPen, faPencil, faUnlockAlt, faUnlock, faEyeSlash,
      faAngleRight, faAngleLeft, faTimes, faQuestion, faSearch, faMinus, faThList,
      // Brand icons
      faFacebook, faGoogle, faTwitter, faInstagram, faYoutube, faPinterest
    );
  }
}
