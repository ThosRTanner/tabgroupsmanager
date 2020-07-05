/*jshint browser: true, devel: true */
/*eslint-env browser */

/* globals TabGroupsManager, TabGroupsManagerJsm */

TabGroupsManager.WindowDnDObserver = function(aSupportDnD)
{
  try
  {
    this.supportDnD = aSupportDnD;
    this.groupDataExtRegExp = new RegExp("\\." + TabGroupsManagerJsm.constValues.groupDataExt + "$", "i");
    this.sessionDataExtRegExp = new RegExp("\\." + TabGroupsManagerJsm.constValues.sessionDataExt + "2?$", "i");
    this.createEventListener();
  }
  catch (e)
  {
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }
};

TabGroupsManager.WindowDnDObserver.prototype.createEventListener = function()
{
  window.addEventListener("dragenter", this, true);
  window.addEventListener("dragover", this, true);
  window.addEventListener("dragleave", this, true);
  window.addEventListener("drop", this, true);
};

TabGroupsManager.WindowDnDObserver.prototype.destroyEventListener = function()
{
  window.removeEventListener("dragenter", this, true);
  window.removeEventListener("dragover", this, true);
  window.removeEventListener("dragleave", this, true);
  window.removeEventListener("drop", this, true);
};

TabGroupsManager.WindowDnDObserver.prototype.handleEvent = function(event)
{
  switch (event.type)
  {
  case "dragenter":
  case "dragover":
    this.onDragOverDelegate(event);
    break;
  case "dragleave":
    this.onDragLeave(event);
    break;
  case "drop":
    this.onDrop(event);
    break;
  }
};

TabGroupsManager.WindowDnDObserver.prototype.onDragOverDelegate = function(event)
{
  if (!this.reentryFlag)
  {
    try
    {
      this.reentryFlag = true;
      this.onDragOver(event);
    }
    finally
    {
      this.reentryFlag = false;
    }
  }
  else
  {
    window.removeEventListener("dragenter", this, true);
    window.removeEventListener("dragover", this, true);
  }
};

TabGroupsManager.WindowDnDObserver.prototype.onDragOver = function(event)
{
  this.supportDnD.hideAll();
  var session = Cc["@mozilla.org/widget/dragservice;1"].getService(Ci.nsIDragService).getCurrentSession();
  if (TabGroupsManager.utils.dataTransferTypesContains(event.dataTransfer, "application/x-tabgroupsmanager-grouptab"))
  {
    var groupTab = this.supportDnD.getDragElementByParent(session.sourceNode, TabGroupsManager.allGroups.groupbar);
    if (groupTab)
    {
      let parentChild = event.target.compareDocumentPosition(TabGroupsManager.xulElements.groupBar);
      if (parentChild == 0 || parentChild == 10)
      {
        return;
      }
      let rect = groupTab.getBoundingClientRect();
      if (event.screenY < TabGroupsManager.groupDnDObserver.dragStartY)
      {
        this.supportDnD.setZZZPositionX((rect.left + rect.right) / 2);
      }
      else
      {
        this.supportDnD.setSuspendPositionX((rect.left + rect.right) / 2);
      }
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.effectAllowed = "all";
      return;
    }
  }
  else if (TabGroupsManager.utils.dataTransferTypesContains(event.dataTransfer, "application/x-moz-file"))
  {
    var file = event.dataTransfer.mozGetDataAt("application/x-moz-file", 0);
    if ((file instanceof Ci.nsIFile))
    {
      if (file.leafName.match(this.groupDataExtRegExp))
      {
        this.supportDnD.setPlusOPositionX(TabGroupsManager.allGroups.groupbar.lastChild.getBoundingClientRect().right);
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.effectAllowed = "all";
      }
      else if (file.leafName.match(this.sessionDataExtRegExp))
      {
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.effectAllowed = "all";
      }
    }
  }
};

TabGroupsManager.WindowDnDObserver.prototype.onDragLeave = function(event)
{
  this.supportDnD.hideAll();
};

TabGroupsManager.WindowDnDObserver.prototype.onDrop = function(event)
{
  this.supportDnD.hideAllNow();
  var session = Cc["@mozilla.org/widget/dragservice;1"].getService(Ci.nsIDragService).getCurrentSession();
  if (TabGroupsManager.utils.dataTransferTypesContains(event.dataTransfer, "application/x-tabgroupsmanager-grouptab"))
  {
    var groupTab = this.supportDnD.getDragElementByParent(session.sourceNode, TabGroupsManager.allGroups.groupbar);
    if (groupTab)
    {
      let parentChild = event.target.compareDocumentPosition(TabGroupsManager.xulElements.groupBar);
      if (parentChild == 0 || parentChild == 10)
      {
        return;
      }
      if (event.screenY < TabGroupsManager.groupDnDObserver.dragStartY)
      {
        groupTab.group.sleepGroup();
      }
      else
      {
        groupTab.group.suspended = !groupTab.group.suspended;
      }
      event.preventDefault();
      event.stopPropagation();
      return;
    }
  }
  else if (TabGroupsManager.utils.dataTransferTypesContains(event.dataTransfer, "application/x-moz-file"))
  {
    let nsIFile = event.dataTransfer.mozGetDataAt("application/x-moz-file", 0);
    if (nsIFile instanceof Ci.nsIFile)
    {
      let result = false;
      let ext = (nsIFile.leafName.match(/\.([^.]+)$/)) ? RegExp.$1 : "";
      switch (ext)
      {
      case TabGroupsManagerJsm.constValues.groupDataExt:
        result = this.importGroup(nsIFile, event.dataTransfer.files);
        break;
      case TabGroupsManagerJsm.constValues.sessionDataExt:
        result = this.importSession(nsIFile, true);
        break;
      case TabGroupsManagerJsm.constValues.sessionDataExt2:
        result = this.importSession(nsIFile, false);
        break;
      }
      if (result)
      {
        event.preventDefault();
        event.stopPropagation();
      }
    }
  }
};

TabGroupsManager.WindowDnDObserver.prototype.importGroup = function(file, files)
{
  if (files)
  {
    let result = false;
    for (let i = 0; i < files.length; i++)
    {
      if (files[i].name.match(this.groupDataExtRegExp))
      {
        result |= this.importGroupFromJson((new TabGroupsManagerJsm.NsIFileWrapper(files[i])).readFileAsText());
      }
    }
    return result;
  }
  else
  {
    let groupDataJson = (new TabGroupsManagerJsm.NsIFileWrapper(file)).readFileAsText();
    return this.importGroupFromJson(groupDataJson);
  }
  return false;
};

TabGroupsManager.WindowDnDObserver.prototype.importGroupFromJson = function(groupDataJson)
{
  try
  {
    let groupData = JSON.parse(groupDataJson);
    if (groupData && groupData.type == TabGroupsManagerJsm.constValues.groupDataType)
    {
      TabGroupsManagerJsm.applicationStatus.modifyGroupId(groupData);
      var group = TabGroupsManager.allGroups.openNewGroupCore(groupData.id, groupData.name, groupData.image);
      group.setGroupDataWithAllTabs(groupData);
      return true;
    }
  }
  catch (e)
  {}
  return false;
};

TabGroupsManager.WindowDnDObserver.prototype.importSession = function(file, old)
{
  try
  {
    let sessionData = null;
    if (old)
    {
      let sessionDataJson = (new TabGroupsManagerJsm.NsIFileWrapper(file)).readFileAsText();
      sessionData = JSON.parse(sessionDataJson);
    }
    else
    {
      sessionData = TabGroupsManagerJsm.saveData.loadTgmDataFromFile(file, true);
    }
    if (sessionData && confirm(TabGroupsManager.strings.getString("ConfirmImportSession")))
    {
      TabGroupsManagerJsm.saveData.restoreSessionFromData(sessionData);
      return true;
    }
  }
  catch (e)
  {}
  return false;
};
