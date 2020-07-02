try
{
  Components.utils.import("resource://gre/modules/PlacesUtils.jsm");
}
catch(e){
  Components.utils.import("resource://gre/modules/utils.js");
}
var TabGroupsManagerPlaces=
{
  get parentWindow(){
    return Components.classes["@mozilla.org/appshell/window-mediator;1"].getService(Components.interfaces.nsIWindowMediator).getMostRecentWindow("navigator:browser");
  },
  get popupNode(){
    return PlacesUIUtils.getViewForNode(document.popupNode).selectedNode;
  },
  openInNewGroup:function(event){
    this.parentWindow.TabGroupsManager.places.openInNewGroup(this.popupNode);
  },
  openInSelectedGroup:function(event){
    this.parentWindow.TabGroupsManager.places.openInSelectedGroup(this.popupNode);
  },
  allOpenInNewGroup:function(event){
    this.parentWindow.TabGroupsManager.places.allOpenInNewGroup(this.popupNode);
  },
  allOpenInSelectedGroup:function(event){
    this.parentWindow.TabGroupsManager.places.allOpenInSelectedGroup(this.popupNode);
  },
};