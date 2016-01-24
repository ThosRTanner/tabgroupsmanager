var TabGroupsManagerProgressmeter=
{
  data:null,
  progress:null,
  initialize:function(event){
    this.data=window.arguments[0];
    this.progress=document.getElementById("TabGroupsManagerProgressmeterMeter");
    if(this.data.progressType){
      this.progress.hidden=(this.data.progressType=="hidden");
      if(this.data.progressType=="undetermined"){
        this.progress.setAttribute(type,"undetermined");
      }
    }
    this.progress.min=this.data.progressMin || 0;
    this.progress.max=this.data.progressMax || 100;
    this.progress.value=this.data.progressValue || 0;
    document.getElementById("TabGroupsManagerProgressmeterDialog").setAttribute("title",this.data.title ||"");
    document.getElementById("TabGroupsManagerProgressmeterMessage").textContent=this.data.message ||"";
    this.data.function.apply(this.data.object,[window,this]);
  },
  finalize:function(event){
    window.close();
  },
};