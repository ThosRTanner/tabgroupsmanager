/*jshint browser: true, devel: true */
/*eslint-env browser */

/* globals TabGroupsManager, TabGroupsManagerJsm */

TabGroupsManager.ToolMenu = function()
{
  document.getElementById("menu_ToolsPopup").addEventListener("popupshowing", this, false);
};

TabGroupsManager.ToolMenu.prototype.handleEvent = function(event)
{
  switch (event.type)
  {
  case "popupshowing":
    document.getElementById("TabGroupsMnagerDispGroupBarInToolBarMenu").hidden = TabGroupsManager.groupBarDispHide.dispGroupBar;
    break;
  }
};
