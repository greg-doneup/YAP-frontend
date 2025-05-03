import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

//Font Awesome
import { FontAwesomeModule, FaIconLibrary  } from '@fortawesome/angular-fontawesome';
import {
  faAngleRight as falAngleRight,
  faAngleLeft as faAngleLeft,
  faSmilePlus as faSmilePlus,
  faCommentDots as faCommentDots,
  faUser as faUser,
  faMapPin as faMapPin,
  faHeart as faHeart,
  faShareAlt as faShareAlt,
  faPaperPlane as faPaperPlane,
  faTimes as faTimes,
  faTrashAlt as faTrashAlt,
  faQuestion as faQuestion,
  faSearch as faSearch,
  faFire as faFire,
  faWallet as faWallet,
  faPen as faPen,
  faPencil as faPencil,
  faQuestionCircle as faQuestionCircle,
  faPlusCircle as faPlusCircle
} from '@fortawesome/pro-light-svg-icons';
import {
  faFacebook as faFacebook,
  faGoogle as faGoogle,
  faTwitter as faTwitter,
  faInstagram as faInstagram,
  faYoutube as faYoutube,
  faPinterest as faPinterest
} from '@fortawesome/free-brands-svg-icons';
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
   faAngleRight as farAngleRight,
   faImage as faImage,
   faMinus as faMinus,
   faNewspaper as faNewspaper,
   faThList as faThList,
   faFile as faFile,
   faEye as faEye,
   faShoppingCart as faShoppingCart,
   faClone as faClone,
   faSlidersH as faSliders,
   faCopy as faCopy,
   faUnlockAlt as faUnlockAlt,
   faUnlock as faUnlock
} from '@fortawesome/pro-regular-svg-icons';
import {
   faHeart as faSolidHeart,
   faStar as faStar,
   faUserEdit as faUserEdit,
   faUserPlus as faUserPlus,
   faUserMinus as faUserMinus,
   faEyeSlash as faEyeSlash
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
    library.addIcons(falAngleRight, faAngleLeft, faLongArrowAltLeft, faSmilePlus, faCommentDots, faEllipsisH, faUser, faMapPin, faHeart, faShareAlt, faPaperPlane, faTimes, faTrashAlt, faQuestion, faSearch, faFire, faPlus, faFileWord, faWallet, faArrowUp, faArrowDown, faHashtag, faReply, faLink, farAngleRight, faImage, faMinus, faPen, faNewspaper, faThList, faFile, faEye, faQuestionCircle, faSolidHeart, faStar, faLongArrowAltRight, faLongArrowAltUp, faUserEdit, faUserPlus, faUserMinus, faPlusCircle, faShoppingCart, faClone, faSliders, faEllipsisV, faCopy, faPencil, faUnlockAlt, faUnlock, faEyeSlash);
  }
}
