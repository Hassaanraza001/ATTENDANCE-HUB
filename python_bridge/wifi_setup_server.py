
import http.server
import socketserver
import subprocess
import json
import os

# Yeh server phone se aane wali requests ko handle karega
PORT = 5000
DIRECTORY = os.path.dirname(os.path.abspath(__file__)) + "/offline_setup"

class CaptivePortalHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_GET(self):
        # Redirect Android/iPhone captive portal checks to our setup page
        # Isse phone par automatic "Sign-in to network" popup aayega
        if "generate_204" in self.path or "redirect" in self.path or "success.html" in self.path or "hotspot-detect" in self.path:
            self.send_response(302)
            self.send_header('Location', 'http://10.42.0.1:5000/')
            self.end_headers()
            return

        # Wi-Fi Networks ki list mangne ke liye API
        if self.path == '/api/wifi-list':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            
            try:
                # nmcli tool se asli Wi-Fi scan karna
                cmd = "nmcli -t -f SSID,SIGNAL,SECURITY dev wifi"
                output = subprocess.check_output(cmd, shell=True, text=True)
                networks = []
                seen = set()
                for line in output.strip().split('\n'):
                    if line and ':' in line:
                        parts = line.split(':')
                        ssid = parts[0]
                        signal = parts[1]
                        if ssid and ssid not in seen and ssid != "BioSync_Setup":
                            networks.append({"ssid": ssid, "signal": signal})
                            seen.add(ssid)
                self.wfile.write(json.dumps(networks).encode())
            except Exception as e:
                self.wfile.write(json.dumps([]).encode())
        else:
            return super().do_GET()

    def do_POST(self):
        # Jab user phone se "CONNECT" dabayega
        if self.path == '/api/connect':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length).decode('utf-8')
            params = json.loads(post_data)
            
            ssid = params.get('ssid')
            password = params.get('password')
            
            print(f"Attempting to connect to {ssid}...")
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            
            try:
                # Pehle response bhejein phir connection badlein
                self.wfile.write(json.dumps({"status": "success"}).encode())
                
                # Command to connect to real Wi-Fi
                # 2 second ruk kar taaki response chala jaye, phir hotspot band karke connect karein
                cmd = f"sleep 2 && nmcli dev wifi connect '{ssid}' password '{password}'"
                subprocess.Popen(cmd, shell=True)
            except Exception as e:
                print(f"Connection Error: {e}")

if __name__ == "__main__":
    if not os.path.exists(DIRECTORY):
        os.makedirs(DIRECTORY)
    os.chdir(DIRECTORY)
    # 0.0.0.0 par listen karna zaroori hai taaki phone Pi se baat kar sake
    with socketserver.TCPServer(("0.0.0.0", PORT), CaptivePortalHandler) as httpd:
        print(f"Captive Portal Active at http://10.42.0.1:{PORT}")
        httpd.serve_forever()
