/*jshint browser: true, devel: true */
/*eslint-env browser */
/* globals TabGroupsManager, TabGroupsManagerJsm */

TabGroupsManager.utils = {
  nsIIOService: Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService)
};

//add result and rename tmp to result because tmp will be 0 if nothing is found
//id is content and arguments are content, tabbrowser, arrowscrollbox
//it seems that from getAnonymousElementByAttribute() nothing will be found here
TabGroupsManager.utils.getElementByIdAndAnonids = function(id)
{
  var result;
  var tmp = document.getElementById(id);
  for (var i = 1; i < arguments.length; i++)
  {
    result = document.getAnonymousElementByAttribute(tmp, "anonid", arguments[i]);
  }
  return result;
};

TabGroupsManager.utils.getElementByElementAndAnonids = function(element)
{
  var tmp = element;
  for (var i = 1; i < arguments.length; i++)
  {
    tmp = document.getAnonymousElementByAttribute(tmp, "anonid", arguments[i]);
  }
  return tmp;
};

TabGroupsManager.utils.isBlankTab = function(tab)
{
  if (tab.linkedBrowser.currentURI.spec == "about:blank" && !tab.hasAttribute("busy"))
  {
    try
    {
      var tabData = JSON.parse(TabGroupsManager.session.getTabStateEx(tab));
      if (tabData.entries.length == 0 || tabData.entries[0].url == "about:blank")
      {
        return true;
      }
    }
    catch (e)
    {
      return true;
    }
  }
  return false;
};

TabGroupsManager.utils.insertElementAfterAnonid = function(parent, anonid, element)
{
  if (!anonid)
  {
    parent.insertBefore(element, parent.childNodes[0]);
    return;
  }
  for (var i = 0; i < parent.childNodes.length; i++)
  {
    if (parent.childNodes[i].getAttribute("anonid") == anonid)
    {
      parent.insertBefore(element, parent.childNodes[i + 1]);
      return;
    }
  }
  parent.insertBefore(element, null);
};

TabGroupsManager.utils.deleteFromAnonidToAnonid = function(parent, from, to)
{
  var element = parent.firstChild;
  if (from)
  {
    element = parent.firstChild;
    for (; element && element.getAttribute("anonid") != from; element = element.nextSibling);
    element = element.nextSibling;
  }
  while (element && (!to || element.getAttribute("anonid") != to))
  {
    var nextElement = element.nextSibling;
    parent.removeChild(element);
    element = nextElement;
  }
};

TabGroupsManager.utils.popupNotContextMenuOnRightClick = function(event)
{
  if (event.button == 2)
  {
    var element = event.currentTarget;
    if (element.hasAttribute("context"))
    {
      element.contextBak = element.getAttribute("context");
      element.removeAttribute("context");
    }
    if (element.contextBak)
    {
      for (var tmp = event.target; tmp && tmp.getAttribute; tmp = tmp.parentNode)
      {
        var context = tmp.getAttribute("context") || tmp.contextBak;
        if (context)
        {
          if (context == element.contextBak)
          {
            document.getElementById(element.contextBak).openPopup(null, null, event.clientX, event.clientY, false, true);
          }
          return;
        }
      }
    }
  }
};

TabGroupsManager.utils.createNewNsiUri = function(aSpec)
{
  return this.nsIIOService.newURI(aSpec, null, null);
};

TabGroupsManager.utils.getTabFromDOMWindow = function(DOMWindow)
{
  try
  {
    if (DOMWindow)
    {
      let index = gBrowser.getBrowserIndexForDocument(DOMWindow.top.document);
      return (index != -1) ? gBrowser.tabContainer.childNodes[index] : null;
    }
  }
  catch (e)
  {
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }
  return null;
};

TabGroupsManager.utils.setRemoveAttribute = function(element, key, value)
{
  if (value)
  {
    element.setAttribute(key, value);
  }
  else
  {
    element.removeAttribute(key);
  }
};

TabGroupsManager.utils.traceProperty = function(root)
{
  let target = root;
  for (let i = 1; i < arguments.length && target; i++)
  {
    target = target[arguments[i]];
  }
  return target;
};

TabGroupsManager.utils.hideTab = function(tab)
{
  if (('undefined' !== typeof tab) && (tab))
  {
    tab.setAttribute("hidden", "true");
    gBrowser._visibleTabs = null; // invalidate cache
    gBrowser.hideTab(tab);
  }
};

TabGroupsManager.utils.unHideTab = function(tab)
{
  if (('undefined' !== typeof tab) && (tab))
  {
    tab.removeAttribute("hidden");
    tab.removeAttribute("collapsed");
    gBrowser._visibleTabs = null; // invalidate cache
    gBrowser.showTab(tab);
  }
};

/**
 * Function to search for strings in DataTransfer types
 * Compatibility with >= FF51
 * @param eventDataTransfer DataTransfer from a event.
 * @param needle string to search for in DataTransfer types.
 * @returns {boolean}
 */
TabGroupsManager.utils.dataTransferTypesContains = function(eventDataTransfer, needle)
{
  let result = false;
  if (('undefined' !== typeof eventDataTransfer) && (eventDataTransfer))
  {
    var dataTransferTypes = eventDataTransfer.mozTypesAt(0);
    if ((dataTransferTypes.length > 0) && (dataTransferTypes.contains(needle)))
    {
      result = true;
    }
  }
  return result;
};
