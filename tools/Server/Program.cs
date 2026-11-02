using Microsoft.Extensions.FileProviders;

// Tiny static file server for the MBG's GameMaster Screen.
// The app itself is plain HTML/CSS/JS; this just avoids file:// quirks.

var opts = new WebApplicationOptions { Args = args };
var builder = WebApplication.CreateBuilder(opts);
var app = builder.Build();

var dir = new DirectoryInfo(AppContext.BaseDirectory);
while (dir != null && !File.Exists(Path.Combine(dir.FullName, "index.html"))) dir = dir.Parent;
if (dir == null)
{
    Console.Error.WriteLine("Could not find index.html above " + AppContext.BaseDirectory);
    return 1;
}

var provider = new PhysicalFileProvider(dir.FullName);

// Optional data bundles are generated locally. Serve an empty stub when they
// are missing so the app starts cleanly without console 404s.
app.Use(async (ctx, next) =>
{
    var path = ctx.Request.Path.Value ?? "";
    if (path.StartsWith("/data/", StringComparison.OrdinalIgnoreCase) &&
        path.EndsWith(".js", StringComparison.OrdinalIgnoreCase))
    {
        var file = Path.Combine(dir.FullName, path.TrimStart('/').Replace('/', Path.DirectorySeparatorChar));
        if (!File.Exists(file))
        {
            ctx.Response.ContentType = "application/javascript; charset=utf-8";
            await ctx.Response.WriteAsync("/* Data bundle not built. Run tools/fetch-data.ps1 and tools/DataBuilder. */\nwindow.DND = window.DND || {};\n");
            return;
        }
    }
    await next();
});

app.UseDefaultFiles(new DefaultFilesOptions { FileProvider = provider });
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = provider,
    OnPrepareResponse = ctx =>
    {
        // During development, always revalidate HTML/JS/CSS.
        if (ctx.File.Name.EndsWith(".html") || ctx.File.Name.EndsWith(".js") || ctx.File.Name.EndsWith(".css"))
            ctx.Context.Response.Headers.CacheControl = "no-cache";
    }
});

var port = 5178;
for (int i = 0; i < args.Length - 1; i++)
    if (args[i] == "--port" && int.TryParse(args[i + 1], out var p)) port = p;

app.MapFallbackToFile("index.html", new StaticFileOptions { FileProvider = provider });

Console.WriteLine($"MBG's GameMaster Screen -> http://localhost:{port}  (root: {dir.FullName})");
app.Run($"http://localhost:{port}");
return 0;
