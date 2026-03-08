#define TINY_GSM_MODEM_SIM7600

#include <Arduino.h>
#include <TinyGsmClient.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

#define SerialMon Serial
#define SerialAT Serial2

#define SIM_RESET 15


//config gprs
const char apn[] = "m3-world";
const char userName[] = "mms";
const char userPass[] = "mms";

//config mqtt
#define MQTT_PORT 1883

const char* broker = "internship2003.cloud.shiftr.io";
const char* mqtt_client_name = "GPS_THUCTAP";
const char* mqtt_user = "internship2003";
const char* mqtt_pass = "BdLKjwoCe4FUrVKC";
const char* topic_gps = "esp32/gps";


TinyGsm modem(SerialAT);
TinyGsmClient gsmClient(modem);
PubSubClient mqtt(gsmClient);

// hàm truyền lệnh AT
void SendAT(String cmd)
{
  SerialAT.println(cmd);
}
// hàm phản hồi
bool waitResponse(unsigned long timeout = 5000)
{
  unsigned long start = millis();

  while (millis() - start < timeout)
  {
    if (SerialAT.available())
    {
      String data = SerialAT.readStringUntil('\n');
      data.trim();
      SerialMon.println(data);

      if (data.indexOf("OK") != -1)
        return true;

      if (data.indexOf("ERROR") != -1)
        return false;
    }
  }

  return false;
}

// init modem
bool initModem()
{
  SendAT("AT");
  if (!waitResponse()) 
  return false;

  SendAT("ATE1");
  if (!waitResponse()) 
  return false;

  SendAT("AT+CMEE=2");
  if (!waitResponse()) 
  return false;

  SendAT("ATI");
  waitResponse();

  return true;
}

//resetmodem
bool restartModem()
{
  SendAT("AT+CRESET");
  if (!waitResponse()) return false;

  delay(5000);

  return initModem();
}

//network
bool checkNetwork()
{
  SerialMon.println("Checking network...");

  SendAT("AT+CREG?");

  unsigned long start = millis();

  while (millis() - start < 30000)
  {
    if (SerialAT.available())
    {
      String line = SerialAT.readStringUntil('\n');
      line.trim();

      SerialMon.println(line);

      if (line.indexOf("+CREG: 0,1") != -1 || line.indexOf("+CREG: 0,5") != -1)
      {
        SerialMon.println("Network OK");
        return true;
      }
    }
  }

  return false;
}

// kết nối gprs
bool connectGPRS()
{
  SerialMon.println("Connecting GPRS...");

  SendAT("AT+CGATT=1");
  waitResponse();

  SendAT(String("AT+CGDCONT=1,\"IP\",\"") + apn + "\"");
  waitResponse();

  SendAT("AT+NETOPEN");
  delay(5000);

  if (!waitResponse())
  {
    SerialMon.println("GPRS FAIL");
    return false;
  }

  SerialMon.println("GPRS CONNECTED");

  return true;
}

// kết nối mqtt
bool mqttConnect()
{
  SerialMon.println("Connecting MQTT...");

  if (mqtt.connect(mqtt_client_name, mqtt_user, mqtt_pass))
  {
    SerialMon.println("MQTT CONNECTED");
    return true;
  }

  SerialMon.println("MQTT FAIL");

  return false;
}

// bật gps
bool enableGPS()
{
  SendAT("AT+CGPS=1");

  if (!waitResponse())
  {
    SerialMon.println("GPS FAIL");
    return false;
  }

  SerialMon.println("GPS ENABLED");

  return true;
}

// lấy gps
bool getDataGPS() 
{ 
  SendAT("AT+CGPSINFO"); 
  unsigned long startTime = millis(); 
  String gpsData = ""; 
while (millis() - startTime < 2000) // timeout 2 giây 
{ 
  while (SerialAT.available() > 0) 
  { 
    String line = SerialAT.readStringUntil('\n'); 
    line.trim(); // xóa /r/n     
    if (line.startsWith("+CGPSINFO:")) // kiểm tra lệnh trả về bắt đầu bằng +CGPSINFO: 
    {       
      gpsData = line; 
    } 
  } 
} 
  if (gpsData == "")  // nếu không có dữ liệu 
  { 
    SerialMon.println("Không nhận được dữ liệu GPS");     
    return false;   } 
  // +CGPSINFO: lat,N,lon,E,date,time,alt,speed,... 
  // +CGPSINFO: 1047.1234,N,10640.5678,E,250725,124530.0,25.1,0,... 
  gpsData.replace("+CGPSINFO: ", ""); // thay + CGPSINFO: bằng khoảng trống   
  gpsData.trim(); 
  if (gpsData.indexOf(",,,,,") != -1) 
  { 
    SerialMon.println("GPS chưa fix tín hiệu");     
    return false;   
  } 
  // Tách dữ liệu   
  int index = 0; 
  String tokens[10];  // tạo mảng để chứa dữ liệu 
  for (int i = 0; i < 10; i++)  
  { 
    int c = gpsData.indexOf(',',index); 
    if (c == -1) 
    { 
      tokens[i] = gpsData.substring(index);      
       break; 
    } 
    tokens[i] = gpsData.substring(index, c); 
    index = c + 1;   } 
  // Gán vào biến 
  float latitude = tokens[0].toFloat();    // vĩ độ ddmm.mmmmmm 
  char ns   = tokens[1].charAt(0);         // N hoặc S  
  float longitude = tokens[2].toFloat();   // kinh độ dddmm.mmmmmm 
  char ew   = tokens[3].charAt(0);         // E hoặc W 
  String dateStr = tokens[4];              // ddmmyy 
  String timeStr = tokens[5];              // hhmmss.s 
  float alt  = tokens[6].toFloat();        // độ cao 
  float speed = tokens[7].toFloat();       // tốc độ 
  float acc = tokens[8].toFloat();         // độ chính xác 
// chuyển đổi vĩ độ kinh độ   
// công thức chuyển đổi decimal_degrees = degrees + (minutes / 60) 
// degress là phần nguyên trước 2 số (vĩ độ), 3 số(kinh độ) 
  // minutes là phần còn lại   
  float latdeg = (int)(latitude / 100);     
  float latmin = latitude -(latdeg * 100);    
  float lat = latdeg + (latmin / 60);  
  if(ns == 'S') lat = -lat;   
  float londeg = (int)(longitude / 100);   
  float lonmin = longitude - (londeg * 100);   
  float lon = londeg + (lonmin / 60);   
  if(ew == 'W') lon = -lon; 
  // tách ngày tháng năm   
  int day   = dateStr.substring(0, 2).toInt();   
  int month = dateStr.substring(2, 4).toInt();   
  int year  = dateStr.substring(4, 6).toInt(); 
  // Tách giờ phút giây  
   int hour   = timeStr.substring(0, 2).toInt();   
   int minute = timeStr.substring(2, 4).toInt();   
   int second = timeStr.substring(4,6).toInt(); 
  // đổi sang giờ việt 
  hour = hour + 7;    // giờ Việt Nam lệnh 7 so với UTC   if (hour >= 24) 
  { 
  hour = hour - 24;  // Việt Nam có 24h   day += 1; // sang ngày mới 
  } 
  // đổi tốc độ từ knots sang km/h   
  speed = speed * 1.852;   
  char time[25]; 
  sprintf(time,"%02d/%02d/%02d,%02d:%02d:%02d+28", year, month, day, hour, minute, second);   String sendingStr = ""; 
  StaticJsonDocument<128> doc;   
  doc["lat"] = lat;   
  doc["lon"] = lon;   
  doc["alt"] = alt; 
  doc["speed"] = speed; 
  doc["time"] = time; 
  serializeJson(doc, sendingStr); 
  mqtt.publish(topic_gps, sendingStr.c_str()); 
  Serial.print("publish: "); 
  Serial.println(sendingStr);// Debug 
  return true; 
} 

void setup()
{
  SerialMon.begin(115200);
  SerialAT.begin(115200, SERIAL_8N1, 16, 17);
  pinMode(SIM_RESET, OUTPUT);
  digitalWrite(SIM_RESET, LOW);
  delay(3000);
  digitalWrite(SIM_RESET, HIGH);
  SerialMon.println("BOOTING...");
  while (!restartModem())
  {
    SerialMon.println("Restart modem...");
    delay(2000);
  }

  while (!checkNetwork())
  {
    SerialMon.println("Waiting network...");
    delay(2000);
  }

  while (!connectGPRS())
  {
    SerialMon.println("Retry GPRS...");
    delay(2000);
  }

  enableGPS();

  mqtt.setServer(broker, MQTT_PORT);

  SerialMon.println("SETUP DONE");
}


unsigned long lastMQTT = 0;
unsigned long lastGPS = 0;
void loop()
{
  if (!mqtt.connected())
  {
    if (millis() - lastMQTT > 10000)
    {
      lastMQTT = millis();
      mqttConnect();
    }
  }
  else
  {
    mqtt.loop();
  }

  if (millis() - lastGPS > 5000)
  {
    lastGPS = millis();

    if (mqtt.connected())
    {
      getDataGPS();
    }
  }
}