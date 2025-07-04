import { NgModule } from '@angular/core';
import { FaIconLibrary, FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import {
  faUser as faUser,
  faHome as faHome,
  faEnvelope as faEnvelope,
  faPhone as faPhone,
  faBell as faBell,
  faSearch as faSearch,
  faShoppingCart as faShoppingCartSolid,
  faCog as faCog,
  faSignOutAlt as faSignOutAlt,
  faEdit as faEdit,
  faTrash as faTrash,
  faPlus as faPlusSolid,
  faMinus as faMinusSolid,
  faCheck as faCheck,
  faTimes as faTimes,
  faExclamationTriangle as faExclamationTriangle,
  faInfoCircle as faInfoCircle,
  faChevronLeft as faChevronLeft,
  faChevronRight as faChevronRight,
  faChevronUp as faChevronUp,
  faChevronDown as faChevronDown,
  faAngleLeft as faAngleLeft,
  faAngleRight as faAngleRight,
  faAngleUp as faAngleUp,
  faAngleDown as faAngleDown,
  faArrowLeft as faArrowLeft,
  faArrowRight as faArrowRight,
  faArrowUp as faArrowUp,
  faArrowDown as faArrowDown,
  faBars as faBars,
  faEllipsisH as faEllipsisH,
  faEllipsisV as faEllipsisV,
  faCalendar as faCalendar,
  faClock as faClock,
  faFileAlt as faFileAlt,
  faDownload as faDownload,
  faUpload as faUpload,
  faShare as faShare,
  faLink as faLink,
  faCopy as faCopy,
  faHeart as faSolidHeart,
  faStar as faStar,
  faUserEdit as faUserEdit,
  faUserPlus as faUserPlus,
  faUserMinus as faUserMinus,
  faEyeSlash as faEyeSlash,
  faEye as faEye
} from '@fortawesome/free-solid-svg-icons';

import {
  faUser as farUser,
  faHeart as farHeart,
  faStar as farStar,
  faCalendar as farCalendar,
  faClock as farClock,
  faFileAlt as farFileAlt,
  faImage as faImage,
  faFile as faFile,
  faNewspaper as faNewspaper,
  faThumbsUp as faThumbsUp,
  faThumbsDown as faThumbsDown,
  faComments as faComments,
  faComment as faComment,
  faBookmark as faBookmark,
  faFlag as faFlag,
  faQuestionCircle as faQuestionCircle,
  faPlusSquare as faPlusSquare,
  faMinusSquare as faMinusSquare,
  faCheckSquare as faCheckSquare,
  faSquare as faSquare,
  faCircle as faCircle,
  faDotCircle as faDotCircle,
  faEnvelope as farEnvelope,
  faAddressBook as faAddressBook,
  faEdit as farEdit,
  faTrashAlt as faTrashAlt,
  faCopy as farCopy,
  faClone as faClone,
  faSave as faSave,
  faFolder as faFolder,
  faFolderOpen as faFolderOpen
} from '@fortawesome/free-regular-svg-icons';

import {
  faFacebook as faFacebook,
  faGoogle as faGoogle,
  faTwitter as faTwitter,
  faInstagram as faInstagram,
  faYoutube as faYoutube,
  faPinterest as faPinterest,
  faLinkedin as faLinkedin,
  faGithub as faGithub,
  faDiscord as faDiscord,
  faReddit as faReddit
} from '@fortawesome/free-brands-svg-icons';

@NgModule({
  declarations: [],
  imports: [FontAwesomeModule],
  exports: [FontAwesomeModule]
})
export class FontAwesomeLibraryModule {
  constructor(library: FaIconLibrary) {
    // Add solid icons
    library.addIcons(
      faUser, faHome, faEnvelope, faPhone, faBell, faSearch, faShoppingCartSolid,
      faCog, faSignOutAlt, faEdit, faTrash, faPlusSolid, faMinusSolid, faCheck, 
      faTimes, faExclamationTriangle, faInfoCircle, faChevronLeft, faChevronRight,
      faChevronUp, faChevronDown, faAngleLeft, faAngleRight, faAngleUp, faAngleDown,
      faArrowLeft, faArrowRight, faArrowUp, faArrowDown, faBars, faEllipsisH,
      faEllipsisV, faCalendar, faClock, faFileAlt, faDownload, faUpload, faShare,
      faLink, faCopy, faSolidHeart, faStar, faUserEdit, faUserPlus, faUserMinus,
      faEyeSlash, faEye
    );

    // Add regular icons
    library.addIcons(
      farUser, farHeart, farStar, farCalendar, farClock, farFileAlt, faImage,
      faFile, faNewspaper, faThumbsUp, faThumbsDown, faComments, faComment,
      faBookmark, faFlag, faQuestionCircle, faPlusSquare, faMinusSquare,
      faCheckSquare, faSquare, faCircle, faDotCircle, farEnvelope, faAddressBook,
      farEdit, faTrashAlt, farCopy, faClone, faSave, faFolder, faFolderOpen
    );

    // Add brand icons
    library.addIcons(
      faFacebook, faGoogle, faTwitter, faInstagram, faYoutube, faPinterest,
      faLinkedin, faGithub, faDiscord, faReddit
    );
  }
}
