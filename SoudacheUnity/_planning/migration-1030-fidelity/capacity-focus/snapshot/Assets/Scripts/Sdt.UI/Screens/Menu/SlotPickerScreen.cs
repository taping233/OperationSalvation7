// Current menu-slots/menu-slot-view host. View and read-only snapshots have separate owners.
using Sdt.UI.Kit;
namespace Sdt.UI.Screens.Menu
{
    public sealed class SlotPickerScreen : Panel
    {
        CurrentSlotPage _page;
        public override void Build(){_page=UIKit.GetOrAdd<CurrentSlotPage>(this);_page.Build(this,Close);}
        public override void CloseFromEscape()=>_page?.BeginClose();
    }
}
