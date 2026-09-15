User Manual screenshots  (used by src/components/UserManual.tsx)
================================================================

Files are sNN.jpg, referenced by section in the manual. To REPLACE a screenshot,
just overwrite the matching sNN.jpg (keep the name). To ADD a new section, add a
Section in UserManual.tsx with shots:[{src:"sNN.jpg"}] and drop the file here.

Mapping (section -> file):

  Login .......................... s01        Client Detail (top/scrolled) . s14, s15
  Home Dashboard ................. s02        Module Settings .............. s16
  Chat panel / Groups ............ s03, s04   Module Group Authority (tab) . s17
  Email menu (header) ............ s05        New Module Addition .......... s18
  Notifications (header) ......... s06        Kick-Off ..................... s19
  Settings: Profile .............. s07        Tracker: Roadmap/Train/CR .... s20, s21, s22
  Settings: Notifications ........ s08        Template Master Excel ........ s23
  Settings: Preferences .......... s09        Sign-Off ..................... s24
  Settings: Bottom Navbar ........ s10        Onsite Management ............ s25
  Clients list ................... s11        SOP of Web Modules ........... s26
  Create Client (Database) ....... s12        Import Master (flow) ......... s27-s32
  Pick a CRM Client .............. s13        Stock Upload (flow) .......... s33-s36
  Content Authority .............. s37        Company Master (tabs) ........ s42-s46
  Content 2D Blueprint ........... s38        Email (full page) ............ s47
  Content 3D Interactive ......... s39        Messages (full page) ......... s48
  ERP Delete: Master ............. s40        User Management .............. s49
  ERP Delete: All Transactions ... s41        Create User (Profile/Auth/Email) s50-s52
  Project Assignment ............. s53, s54   Database Backup .............. s55
  Module Group Authority ......... s56, s57

Images are optimized JPG (max 1600px). The manual loads only the open section's
images, so keeping them here is lightweight.
