/*jshint browser: true, devel: true */
/*eslint-env browser */

/* globals TabGroupsManager, TabGroupsManagerJsm */

TabGroupsManager.LocalGroupIcons = function () {};

TabGroupsManager.LocalGroupIcons.prototype.removeMenu = function (event)
{
  TabGroupsManager.utils.deleteFromAnonidToAnonid(event.target, "start_icon", "end_icon");
};

TabGroupsManager.LocalGroupIcons.prototype.createMenu = function (event)
{
  this.removeMenu(event);
  let flgmntNode = document.createDocumentFragment();
  let iconFolders = TabGroupsManagerJsm.globalPreferences.jsonPrefToObject("localIconFilders");
  for (let i = 0; i < iconFolders.length; i++)
  {
    let iconFolderName = iconFolders[i];
    let iconFolder = TabGroupsManagerJsm.folderLocation.makeNsIFileWrapperFromURL(iconFolderName);
    this.makeIconListOneLine(flgmntNode, iconFolder, iconFolderName);
  }
  let popup = event.target;
  for (var i = 0; i < popup.childNodes.length; i++)
  {
    if (popup.childNodes[i].getAttribute("anonid") == "start_icon")
    {
      popup.childNodes[i].hidden = (flgmntNode.childNodes.length <= 0);
    }
  }
  if (flgmntNode.childNodes.length > 0)
  {
    TabGroupsManager.utils.insertElementAfterAnonid(popup, "start_icon", flgmntNode);
  }
};

TabGroupsManager.LocalGroupIcons.prototype.makeIconListOneLine = function (parent, folder, folderName)
{
  if (folder.exists)
  {
    let files = folder.getArrayOfFileRegex(".*\.(:?png|gif|jpg|jpeg|ico)$");
    if (files.length > 0)
    {
      let hbox = document.createElementNS("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul", "hbox");
      hbox.setAttribute("style", "margin-left:20px;");
      parent.appendChild(hbox);
      for (let i = 0; i < files.length; i++)
      {
        let menuitem = document.createElementNS("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul", "menuitem");
        menuitem.setAttribute("label", "");
        menuitem.setAttribute("image", folderName + files[i].leafName);
        menuitem.setAttribute("class", "tabgroupsmanager-menuitem-icon-only");
        menuitem.setAttribute("validate", "never");
        menuitem.setAttribute("tooltiptext", files[i].leafName);
        //menuitem.setAttribute("oncommand","TabGroupsManager.groupMenu.popupGroup.changeIconFromLocal( event );");
        menuitem.addEventListener("command", function (event)
        {
          TabGroupsManager.groupMenu.popupGroup.changeIconFromLocal(event);
        }, false);

        hbox.appendChild(menuitem);
      }
    }
    let folders = folder.getArrayOfFolderRegex("^[^.]");
    for (var i = 0; i < folders.length; i++)
    {
      this.makeIconListOneLine(parent, folders[i], folderName + folders[i].leafName + "/");
    }
  }
};
