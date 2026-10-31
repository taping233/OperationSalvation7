// Native first frame: this executable paints before copying or extracting the payload.
using System;
using System.IO;
using System.Reflection;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Windows.Forms;
using System.Threading.Tasks;
using System.Text.RegularExpressions;
using System.Runtime.InteropServices;

class Portable : Form {
    [DllImport("user32.dll")] static extern bool SetProcessDPIAware();
    readonly string root = Path.Combine(Path.GetTempPath(), "c7-launch-" + Guid.NewGuid().ToString("N"));
    readonly string[] arguments;
    readonly Timer slides = new Timer { Interval = 4500 };
    Image wallpaper;
    int slide, progress;
    string status = "正在准备游戏资源";
    Process child;
    volatile bool cancelled;
    bool complete;
    readonly bool nodeMode;
    int result = 1;
    static Assembly Assembly { get { return Assembly.GetExecutingAssembly(); } }

    Portable(string[] args) {
        arguments = args;
        nodeMode = Environment.GetEnvironmentVariable("ELECTRON_RUN_AS_NODE") == "1";
        Text = "升格会的冬日猜想 · 加载中";
        AutoScaleMode = AutoScaleMode.None;
        FormBorderStyle = FormBorderStyle.None;
        StartPosition = FormStartPosition.Manual;
        Bounds = Screen.FromPoint(Cursor.Position).Bounds;
        BackColor = Color.FromArgb(8,11,14);
        DoubleBuffered = true;
        if (!nodeMode) {
            LoadSlide();
            slides.Tick += delegate { slide = (slide + 1) % 6; LoadSlide(); Invalidate(); };
            var quit = new Button { Text = "退出游戏", Width = 100, Height = 34, FlatStyle = FlatStyle.Flat,
                ForeColor = Color.White, BackColor = Color.FromArgb(22,30,34), Anchor = AnchorStyles.Right | AnchorStyles.Bottom };
            quit.Location = new Point(ClientSize.Width - 150, ClientSize.Height - 68);
            quit.Click += delegate { Close(); };
            Controls.Add(quit);
        }
    }
    void LoadSlide() {
        using (var stream = Assembly.GetManifestResourceStream("wallpaper" + slide))
        using (var image = Image.FromStream(stream)) {
            var previous = wallpaper; wallpaper = new Bitmap(image);
            if (previous != null) previous.Dispose();
        }
    }
    protected override void OnPaint(PaintEventArgs e) {
        base.OnPaint(e);
        var g = e.Graphics;
        if (wallpaper != null) {
            float scale = Math.Max((float)Width / wallpaper.Width, (float)Height / wallpaper.Height);
            float w = wallpaper.Width * scale, h = wallpaper.Height * scale;
            g.DrawImage(wallpaper, (Width-w)/2, (Height-h)/2, w, h);
        }
        using (var shade = new LinearGradientBrush(new Rectangle(0, Height/3, Width, Height*2/3+1),
            Color.Transparent, Color.FromArgb(250,8,11,14), LinearGradientMode.Vertical))
            g.FillRectangle(shade, 0, Height/3, Width, Height*2/3+1);
        int x = (int)(Width*.06), right = Width-x, y = Height-210;
        using (var small = new Font("Microsoft YaHei", 10))
        using (var title = new Font("Microsoft YaHei", 26))
        using (var label = new Font("Microsoft YaHei", 12))
        using (var dim = new SolidBrush(Color.FromArgb(180,201,211))) {
            g.DrawString("WINTER CONJECTURE / 代号柒", small, dim, x, y);
            g.DrawString("升格会的冬日猜想", title, Brushes.White, x, y+25);
            g.DrawString(status, label, Brushes.White, x, y+90);
            g.DrawString(progress + "%", label, Brushes.White, right-60, y+90);
            g.FillRectangle(dim, x, y+125, right-x, 3);
            g.FillRectangle(Brushes.LightBlue, x, y+125, (right-x)*progress/100, 4);
            g.DrawString("首次准备需要展开游戏资源，完成后自动进入。", small, dim, x, y+145);
        }
    }
    void Report(int value, string label) {
        if (nodeMode || cancelled || IsDisposed) return;
        try { BeginInvoke((Action)delegate { progress = Math.Max(progress,value); status = label; Invalidate(); }); }
        catch (InvalidOperationException) { }
    }
    void SaveResource(string resource, string file, bool payload) {
        using (var input = Assembly.GetManifestResourceStream(resource))
        using (var output = File.Create(file)) {
            var buffer = new byte[1024*1024]; int count; long copied=0;
            while ((count=input.Read(buffer,0,buffer.Length))>0) {
                if (cancelled) throw new OperationCanceledException();
                output.Write(buffer,0,count); copied+=count;
                if (payload) Report((int)(copied*8/input.Length), "正在读取便携游戏资源");
            }
        }
    }
    // Windows CommandLineToArgvW quoting, including quotes and trailing slashes.
    static string Quote(string argument) {
        return "\"" + Regex.Replace(Regex.Replace(argument, "(\\\\*)\"", "$1$1\\\""), "(\\\\+)$", "$1$1") + "\"";
    }
    void Work() {
        try {
            Directory.CreateDirectory(root);
            string archive=Path.Combine(root,"payload.7z"), extractor=Path.Combine(root,"7za.exe"), app=Path.Combine(root,"app");
            SaveResource("extractor",extractor,false); SaveResource("payload",archive,true);
            Report(8,"正在展开游戏资源");
            var extract = new ProcessStartInfo(extractor, "x " + Quote(archive) + " -o" + Quote(app) + " -y -bsp1 -bso0 -bse1") {
                UseShellExecute=false, CreateNoWindow=true, RedirectStandardOutput=true, RedirectStandardError=true };
            child=new Process { StartInfo=extract };
            child.OutputDataReceived += delegate(object sender, DataReceivedEventArgs evt) {
                var match=Regex.Match(evt.Data ?? "", @"(\d+)%");
                if(match.Success) Report(8+int.Parse(match.Groups[1].Value)*47/100,"正在展开游戏资源");
            };
            child.Start(); child.BeginOutputReadLine();
            string error=child.StandardError.ReadToEnd(); child.WaitForExit();
            if(cancelled) throw new OperationCanceledException();
            if(child.ExitCode!=0) throw new Exception("资源展开失败："+error);
            string exe=Path.Combine(app,"搜打撤·代号7.exe");
            if(!File.Exists(exe)) throw new FileNotFoundException("游戏主程序缺失",exe);
            Report(55,"游戏资源已就绪，正在启动主页");
            if(cancelled) throw new OperationCanceledException();
            var quoted = Array.ConvertAll(arguments, Quote);
            var launch=new ProcessStartInfo(exe,string.Join(" ",quoted)) { UseShellExecute=false, WorkingDirectory=app };
            launch.EnvironmentVariables["PORTABLE_EXECUTABLE_DIR"]=Path.GetDirectoryName(Assembly.Location);
            launch.EnvironmentVariables["PORTABLE_EXECUTABLE_FILE"]=Assembly.Location;
            if(!nodeMode) launch.EnvironmentVariables["SDT_PORTABLE_READY"]=Path.Combine(root,"window-ready");
            child=Process.Start(launch);
            while(!child.WaitForExit(50)) {
                if(cancelled) { child.Kill(); break; }
                if(!nodeMode && File.Exists(Path.Combine(root,"window-ready"))) {
                    BeginInvoke((Action)delegate { slides.Stop(); Hide(); });
                    child.WaitForExit(); break;
                }
            }
            result=child.ExitCode;
            complete=true;
            // Only this invocation's unique temporary root is eligible for cleanup.
            if(Path.GetDirectoryName(root)==Path.GetTempPath().TrimEnd(Path.DirectorySeparatorChar)
                && Path.GetFileName(root).StartsWith("c7-launch-")) {
                for(int i=0;i<10;i++) {
                    try { Directory.Delete(root,true); break; }
                    catch(IOException) { System.Threading.Thread.Sleep(200); }
                    catch(UnauthorizedAccessException) { System.Threading.Thread.Sleep(200); }
                }
            }
        } catch(OperationCanceledException) { result=0; }
        catch(Exception ex) {
            result=1;
            if(!nodeMode && !cancelled) MessageBox.Show("游戏未能完成加载。\n"+ex.Message+"\n诊断目录："+root,"代号柒",MessageBoxButtons.OK,MessageBoxIcon.Error);
        } finally {
            complete=true;
            if(!nodeMode && !IsDisposed) { try { BeginInvoke((Action)delegate { Close(); }); } catch(InvalidOperationException) { } }
        }
    }
    protected override void OnShown(EventArgs e) {
        base.OnShown(e); Refresh(); slides.Start(); Task.Factory.StartNew(Work);
    }
    protected override void OnFormClosing(FormClosingEventArgs e) {
        slides.Stop();
        if(!complete) { cancelled=true; try { if(child!=null && !child.HasExited) child.Kill(); } catch(InvalidOperationException) { } }
        base.OnFormClosing(e);
    }
    [STAThread] static int Main(string[] args) {
        SetProcessDPIAware();
        Application.EnableVisualStyles(); Application.SetCompatibleTextRenderingDefault(false);
        using(var launcher=new Portable(args)) {
            if(launcher.nodeMode) launcher.Work(); else Application.Run(launcher);
            return launcher.result;
        }
    }
}
