/*jshint browser: true, devel: true */
/*eslint-env browser */

/* globals TabGroupsManager, TabGroupsManagerJsm */

TabGroupsManager.GroupMenu = function ()
{
  this.popupGroupTab = null;
  this.popupGroup = null;
};

TabGroupsManager.GroupMenu.prototype.showingGroupMenu = function (event)
{
  document.getElementById("TabGroupsManagerGroupContextMenuReload").disabled = this.popupGroup.suspended;
  var suspendMenuitem = document.getElementById("TabGroupsManagerGroupContextMenuSuspend");
  if (this.popupGroup.suspended)
  {
    suspendMenuitem.setAttribute("checked", "true");
  }
  else
  {
    suspendMenuitem.removeAttribute("checked");
    suspendMenuitem.disabled = (2 > TabGroupsManager.allGroups.countNonSuspendedGroups());
  }
};

TabGroupsManager.GroupMenu.prototype.showingRenameSubmenu = function (event)
{
  TabGroupsManager.openMenu.onShowingRename(event);
  TabGroupsManager.localGroupIcons.createMenu(event);
  document.getElementById("TabGroupsManagerDisableAutoRenameMenu").setAttribute("checked", this.popupGroup.disableAutoRename);
};

TabGroupsManager.GroupMenu.prototype.hiddenRenameSubmenu = function (event)
{
  TabGroupsManager.openMenu.onHidden(event);
  TabGroupsManager.localGroupIcons.removeMenu(event);
};
