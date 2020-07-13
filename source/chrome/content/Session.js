/*jshint browser: true, devel: true */
/*eslint-env browser */

/* globals TabGroupsManager, TabGroupsManagerJsm, gBrowser, Cc, Ci */

TabGroupsManager.Session = function()
{
  try
  {
    this.groupRestored = 0;
    this.sessionRestoring = false;
    this.disableOnSSTabRestoring = false;
    this.sessionRestoreManually = false;
    this.sessionStore = Cc["@mozilla.org/browser/sessionstore;1"].getService(Ci.nsISessionStore);
    this.createEventListener();
  }
  catch (e)
  {
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }
};

TabGroupsManager.Session.prototype.createEventListener = function()
{
  gBrowser.tabContainer.addEventListener("SSTabRestoring", this);
  window.addEventListener("SSWindowStateBusy", this);
  window.addEventListener("SSWindowStateReady", this);
};

TabGroupsManager.Session.prototype.destroyEventListener = function()
{
  gBrowser.tabContainer.removeEventListener("SSTabRestoring", this);
  window.removeEventListener("SSWindowStateBusy", this);
  window.removeEventListener("SSWindowStateReady", this);
};

TabGroupsManager.Session.prototype.handleEvent = function(event)
{
  try
  {
    switch (event.type)
    {
    case "SSTabRestoring":
      this.onSSTabRestoring(event);
      break;
    case "SSWindowStateBusy":
      this.onSSWindowStateBusy(event);
      break;
    case "SSWindowStateReady":
      this.onSSWindowStateReady(event);
      break;
    }
  }
  catch (e)
  {
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }
};

//It looks as though in palemoon, we get
//1) Busy
//2) each window being restored
//3) Ready
//
//but in basilisk, 3 happens before 2
//
//This means we have to restore the group information when we restore the first
//tab
//
TabGroupsManager.Session.prototype.onSSWindowStateBusy = function(event)
{
/**/console.log("busy");
  this._restore_count = 0;
  this._restore_groups = true;
  this.groupRestored = 0; //FIXME Why is this exposed? why aren't the clients
                          //checking if the session is being restored?
  this.sessionRestoring = true;
};

TabGroupsManager.Session.prototype.onSSWindowStateReady = function(event)
{
/**/console.log("start waiting", this._restore_count, gBrowser.tabContainer.children.length);
  if (this._restore_count == 0)
  {
    this._restore_count = gBrowser.tabContainer.children.length;
  }
  else
  {
    this._restore_complete();
  }
};

TabGroupsManager.Session.prototype._restore_complete = function()
{
  this.sessionRestoring = false;
  TabGroupsManager.groupBarDispHide.firstStatusOfGroupBarDispHide();
  TabGroupsManager.allGroups.scrollInActiveGroup();
/**/console.log("complete", this._restore_count);
};

TabGroupsManager.Session.prototype.onSSTabRestoring = function(event)
{
  if (this._restore_groups)
  {
    //FIXME again, this groupRestored thing. This is sequential so the setting
    //of 1 is pointless. and it doesn't belong to this class anyway.
    this.groupRestored = 1;
    try
    {
      TabGroupsManager.allGroups.loadAllGroupsData();
    }
    catch (err)
    {
      TabGroupsManagerJsm.displayError.alertErrorIfDebug(err);
    }
    this.groupRestored = 2;
    this._restore_groups = false;
  }

  if (! this.disableOnSSTabRestoring)
  {
    this.moveTabToGroupBySessionStore(event.originalTarget);
  }

  this._restore_count -= 1;
  if (this._restore_count == 0)
  {
    this._restore_complete();
  }
};

TabGroupsManager.Session.prototype.moveTabToGroupBySessionStore = function(restoringTab)
{
  try
  {
    var groupId = this.getGroupId(restoringTab);
    if (isNaN(groupId))
    {
/**/console.log("no group???", restoringTab.group)
      //FIXME If restoringTab has a group and the groupId isn't valid, why we do
      //we have this test...
      groupId = (restoringTab.group) ? restoringTab.group.id : TabGroupsManager.allGroups.selectedGroup.id;
      this.sessionStore.setTabValue(restoringTab, "TabGroupsManagerGroupId", groupId.toString());
    }
    if (restoringTab.group && restoringTab.group.id == groupId)
    {
      return;
    }
    var group = TabGroupsManager.allGroups.getGroupById(groupId);
    if (group)
    {
      this.moveTabToGroupWithSuspend(group, restoringTab);
      return;
    }
    if (null == TabGroupsManagerJsm.applicationStatus.getGroupById(groupId))
    {
      var groupName = this.sessionStore.getTabValue(restoringTab, "TabGroupsManagerGroupName");
      var group = TabGroupsManager.allGroups.openNewGroupCore(groupId, groupName);
/**/console.log("unexpected group?", groupId, groupName)
      this.moveTabToGroupWithSuspend(group, restoringTab);
      return;
    }
/**/console.log("yelp? this should NOT occur")
  }
  catch (e)
  {
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }
};

TabGroupsManager.Session.prototype.moveTabToGroupWithSuspend = function(group, tab)
{
  if (tab == gBrowser.selectedTab)
  {
    group.suspended = false;
    group.addTab(tab, true);
    group.selectedTab = tab;
    group.setSelected();
  }
  else
  {
    group.addTab(tab, true);
  }
};

TabGroupsManager.Session.prototype.getGroupId = function(tab)
{
  return parseInt(this.sessionStore.getTabValue(tab, "TabGroupsManagerGroupId"), 10);
};

TabGroupsManager.Session.prototype.setGroupNameAllTabsInGroup = function(group)
{
  for (var i = 0; i < group.tabArray.length; i++)
  {
    this.sessionStore.setTabValue(group.tabArray[i], "TabGroupsManagerGroupName", group.name);
  }
};

TabGroupsManager.Session.prototype.backupByManually = function()
{
  TabGroupsManagerJsm.saveData.backupByManually();
};

TabGroupsManager.Session.prototype.exportDataEmergency = function(message)
{
  let strings = window.TabGroupsManager.strings;
  alert(strings.getString(message) + strings.getString("ExportDataEmergency"));
  this.exportSession();
};

TabGroupsManager.Session.prototype.exportSession = function()
{
  let nsIFilePicker = Ci.nsIFilePicker;
  let filePicker = Cc["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
  filePicker.init(window, null, nsIFilePicker.modeSave);
  filePicker.appendFilter(TabGroupsManager.strings.getString("SessionDataExtDescription") + "(*." + TabGroupsManagerJsm.constValues.sessionDataExt2 + ")", "*." + TabGroupsManagerJsm.constValues.sessionDataExt2);
  filePicker.appendFilters(nsIFilePicker.filterAll);
  filePicker.defaultString = "TabGroupsManager_Session_" + TabGroupsManagerJsm.applicationStatus.getNowString() + "." + TabGroupsManagerJsm.constValues.sessionDataExt2;
  filePicker.defaultExtension = TabGroupsManagerJsm.constValues.sessionDataExt2;
  let result = filePicker.show();
  if (result == nsIFilePicker.returnOK || result == nsIFilePicker.returnReplace)
  {
    try
    {
      TabGroupsManagerJsm.saveData.saveFileFromTgmData(filePicker.file);
    }
    catch (e)
    {
      TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
    }
  }
};

TabGroupsManager.Session.prototype.onShowingBackupSessionMenu = function(event)
{
  var menuPopup = event.originalTarget;
  TabGroupsManager.session.onHiddenBackupSessionMenu(event);
  var flgmntNode = document.createDocumentFragment();
  let list = TabGroupsManagerJsm.saveData.dataFolder.getArrayOfFileRegex(TabGroupsManagerJsm.saveData.backupSwapFileRegexp);
  this.makeRestoresSessionMenu(flgmntNode, list, true);
  list = TabGroupsManagerJsm.saveData.dataFolder.getArrayOfFileRegex(TabGroupsManagerJsm.saveData.backupManuallyFileRegexp);
  this.makeRestoresSessionMenu(flgmntNode, list, true);
  list = TabGroupsManagerJsm.saveData.dataFolder.getArrayOfFileRegex(TabGroupsManagerJsm.saveData.backupWindowCloseFileRegexp);
  this.makeRestoresSessionMenu(flgmntNode, list, true);
  list = TabGroupsManagerJsm.saveData.dataFolder.getArrayOfFileRegex(TabGroupsManagerJsm.saveData.backupTimerFileRegexp);
  this.makeRestoresSessionMenu(flgmntNode, list, true);
  list = TabGroupsManagerJsm.saveData.dataFolder.getArrayOfFileRegex(TabGroupsManagerJsm.saveData.dataFileRegexp);
  this.makeRestoresSessionMenu(flgmntNode, list, false);
  menuPopup.appendChild(flgmntNode);
};

TabGroupsManager.Session.prototype.makeRestoresSessionMenu = function(flgmntNode, list, reverseSort)
{
  if (list.length <= 0)
  {
    return;
  }
  let menuitem = document.createElement("menuseparator");
  flgmntNode.appendChild(menuitem);
  list.sort(reverseSort ? TabGroupsManagerJsm.NsIFileWrapper.prototype.compareByLeafNameReverse : TabGroupsManagerJsm.NsIFileWrapper.prototype.compareByLeafName);
  for (var i = 0; i < list.length; i++)
  {
    let one = list[i];
    let menuitem = document.createElement("menuitem");
    let label = one.leafName;
    label = label.replace(TabGroupsManagerJsm.saveData.backupSwapFileRegexp, TabGroupsManager.strings.getString("ReplaceSessionBackupSwap"));
    label = label.replace(TabGroupsManagerJsm.saveData.backupManuallyFileRegexp, TabGroupsManager.strings.getString("ReplaceSessionSave"));
    label = label.replace(TabGroupsManagerJsm.saveData.backupWindowCloseFileRegexp, TabGroupsManager.strings.getString("ReplaceSessionBackupWindowCloseLabel"));
    label = label.replace(TabGroupsManagerJsm.saveData.backupTimerFileRegexp, TabGroupsManager.strings.getString("ReplaceSessionBackupByTimerLabel"));
    if (label.match(TabGroupsManagerJsm.saveData.dataFileRegexp))
    {
      label = label.replace(TabGroupsManagerJsm.saveData.dataFileNowRegexp, TabGroupsManager.strings.getString("ReplaceSessionSaveDataNow"));
      label = label.replace(TabGroupsManagerJsm.saveData.dataFileMirrorRegexp, TabGroupsManager.strings.getString("ReplaceSessionSaveDataMirror"));
      label = label.replace(TabGroupsManagerJsm.saveData.dataFileRegexp, TabGroupsManager.strings.getString("ReplaceSessionSaveData"));
    }
    else
    {
      menuitem.setAttribute("context", "TabGroupsManagerSessionContextMenu");
    }
    menuitem.setAttribute("value", one.leafName);
    menuitem.setAttribute("label", label);
    menuitem.setAttribute("tooltiptext", TabGroupsManager.strings.getString("SessionBackupTooltip"));
    //menuitem.setAttribute("oncommand","TabGroupsManager.session.restoreSessionCommand(event);");
    menuitem.addEventListener("command", function(event)
    {
      TabGroupsManager.session.restoreSessionCommand(event);
    }, false);

    flgmntNode.appendChild(menuitem);
  }
};

TabGroupsManager.Session.prototype.onHiddenBackupSessionMenu = function(event)
{
  var menuPopup = event.originalTarget;
  menuitem = menuPopup.childNodes[2];
  while (menuitem)
  {
    menuPopup.removeChild(menuitem);
    menuitem = menuPopup.childNodes[2];
  }
};

TabGroupsManager.Session.prototype.restoreSessionCommand = function(event)
{
  TabGroupsManagerJsm.saveData.restoreSession(event.originalTarget.getAttribute("value"));
};

TabGroupsManager.Session.prototype.restoreSessionInit = function()
{
  TabGroupsManager.allGroups.openNewGroup(null, -1, null, null);
  var groupTab = TabGroupsManager.allGroups.childNodes;
  for (var i = groupTab.length - 2; i >= 0; i--)
  {
    groupTab[i].group.closeAllTabsAndGroup();
  }
  this.groupRestored = 0;
  this.sessionRestoreManually = true;
};

TabGroupsManager.Session.prototype.restoreSessionFromAboutSessionRestore = function()
{
/**/console.log("restoreSessionFromAboutSessionRestore", new Error())
  TabGroupsManager.allGroups.selectedGroup.id = -1;
  this.groupRestored = 0;
  this.sessionRestoreManually = true;
};

TabGroupsManager.Session.prototype.menuitemDelete = function(event)
{
  TabGroupsManagerJsm.saveData.deleteSession(document.popupNode.getAttribute("value"));
};

TabGroupsManager.Session.prototype.setClosedTabJson = function(jsonData)
{
  //FIXME Why do we stop watching these events when we're doing this? it
  //doesn't stop the even happening. and there isn't anything async in here.
  window.removeEventListener("SSWindowStateBusy", this, false);
  window.removeEventListener("SSWindowStateReady", this, false);
  try
  {
    let stateJson = JSON.stringify(
    {
      windows: [
      {
        tabs: [],
        _closedTabs: JSON.parse(jsonData)
      }],
      _firstTabs: true
    });
    this.sessionStore.setWindowState(window, stateJson, false);
  }
  catch (e)
  {
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }
  finally
  {
    window.addEventListener("SSWindowStateBusy", this, false);
    window.addEventListener("SSWindowStateReady", this, false);
  }
};

TabGroupsManager.Session.prototype.getTabStateEx = function(tab)
{
  //when do we get no textbox in about:config? -> override this for E10s
  if (!tab.linkedBrowser.ownerDocument.defaultView.gMultiProcessBrowser)
  {
    if (tab.linkedBrowser && tab.linkedBrowser.currentURI.spec == "about:config" && !tab.linkedBrowser.contentDocument.getElementById("textbox"))
    {
      this.tmpOverrideGetElementByIdForAboutConfig(tab);
      try
      {
        return this.sessionStore.getTabState(tab);
      }
      finally
      {
        delete tab.linkedBrowser.contentDocument.getElementById;
      }
    }
  }
  return this.sessionStore.getTabState(tab);
};

TabGroupsManager.Session.prototype.duplicateTabEx = function(aWindow, tab)
{
  //when do we get no textbox in about:config? -> override this for E10s
  if (!tab.linkedBrowser.ownerDocument.defaultView.gMultiProcessBrowser)
  {
    if (tab.linkedBrowser && tab.linkedBrowser.currentURI.spec == "about:config" && !tab.linkedBrowser.contentDocument.getElementById("textbox"))
    {
      this.tmpOverrideGetElementByIdForAboutConfig(tab);
      try
      {
        return this.sessionStore.duplicateTab(aWindow, tab);
      }
      finally
      {
        delete tab.linkedBrowser.contentDocument.getElementById;
      }
    }
  }
  return this.sessionStore.duplicateTab(aWindow, tab);
};

TabGroupsManager.Session.prototype.tmpOverrideGetElementByIdForAboutConfig = function(tab)
{
  //http://zpao.com/posts/session-restore-changes-in-firefox-15/ > '#' removed > fx 15
  //Bug 947212 - Broadcast form data and move it out of tabData.entries[] > fx 29
  //let state = JSON.parse(this.sessionStore.getTabState(tab));
  //let textbox = state.formdata.id["textbox"];

  //no reason to fix this, there is always a textbox element for about:config - not sure when this will be called
  //FIXME There isn't always a textbox - if it's on the here be  dragons page,
  //      there isn't one.
  let ssData = tab.linkedBrowser.__SS_data;
  let textbox = ssData.entries[ssData.index - 1].formdata["#textbox"];
  tab.linkedBrowser.contentDocument.getElementById = function()
  {
    return {
      value: textbox
    }
  };
};
