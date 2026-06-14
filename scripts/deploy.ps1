Add-Type @"
using System.Net;
using System.Net.Security;
using System.Security.Cryptography.X509Certificates;
public class SSLFix {
    public static void Fix() {
        ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12;
        ServicePointManager.ServerCertificateValidationCallback =
            new RemoteCertificateValidationCallback(delegate { return true; });
    }
}
"@
[SSLFix]::Fix()
$r = Invoke-WebRequest -Uri 'https://api.vercel.com/v1/integrations/deploy/prj_BsnjqH1fWSVuuccNiu0yue2q5wR6/sWvwXpSrjd' -UseBasicParsing
Write-Host $r.Content
