# **Photos Processing Protocol: From Photograph to [Ikiam Wings Gallery website](http://wings.gallery.info.gf)**

This protocol provides a complete, step-by-step guide for photographing butterfly wings, processing the images, and integrating them into the Ikiam Wings Gallery database.

## **Taking the Photos**

1. Mount the camera to the articulated arm.  
2. Install a level‑bubble app on your phone and use the camera's grid so the sensor is perfectly horizontal.  
3. **Frame the work area:**  
   * Confirm the ruler at the bottom of the frame appears straight.  
   * Position the penciled cross on the mounting board slightly to the left of the center (color palette on right takes more space than envelope on left).  
4. **Manual Focus:**  
   * Place a single wing in the center of the frame and zoom in. Manually adjust the focus until this wing is perfectly sharp. Check focus and framing often.  
5. **Wing and accessories placement:**  
   * Place the dorsal side of the wings (side that touches when closed \- shows visible hair pencils if male) one per quadrant.  
   * Position color palette on right side, envelope with CAMID on left side  
6. **Take photos:**  
   * Use a remote shutter or a 5-second timer to prevent camera shake.  
   * Capture dorsal side, then flip wings (exchange left wings to right side and vice versa) for ventral side  
7. **Quality check:**  
   * Press play button frequently to review photos, checking for consistent focus, lighting, and positioning.

## **File Renaming with AI**

1. Copy files from the SD card into **clearly labeled** batch folders by date (e.g., "batch june 20", "batch july 2")  
2. Select new files by creation date—start one day after the last copied batch. Display files in list to view files creation date.  
3. Launch Rename\_Photos\_AI\_v2 (download from [GitHub](https://github.com/Fr4nzz/rename_photos_AI)).  
4. In Process Images, click Browse and choose the batch folder.  
5. **Rotate every file 180° (If needed):**  
   * Disable EXIF rotation (this ignores unpredictable camera gyro data, due to its horizontal placing).  
   * Click Apply rotation to files once for JPG/PNG/HEIC  
   * Then enable "Process RAW images" checkbox to rotate RAW files (.CR2, .ORF)  
   * For the CANON camera we only need to rotate the RAW .CR2 files.
6. Enable cropping so the AI sees only the CAM\_ID region.  
7. Insert Gemini API keys (one per line) from [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)  
   * Gemini‑2.5‑pro: 100 requests/day; the app sends 9 images per request—≈ 900 images per key per day.
8. Click Ask Gemini (Start). If the run stops with an error, simply press the button again to resume.

## **Review and Rename**

1. Go to "Review Results" tab  
2. Check AI-transcribed CAMIDs, correct any mistakes. (misread numbers e.g. 3 to 8, 7 to 1\)  
3. Look for warnings about unpaired CAMIDs (should have exactly 2 images per individual)  
4. Check "Skip this file" for any files to exclude from renaming (if photo is blurred, or if two dorsal photos taken by accident, skip one)  
5. Note CAMIDs that need re-photography  
6. Click "Recalculate final names" (appends "d.JPG" for dorsal, "v.JPG" for ventral)  
7. Click "Rename Files" to apply new names to both JPG and RAW files

## **Uploading to Google Drive**

### **Setup Google Drive**

1. Install Google Drive: Download from [Google Drive](https://drive.google.com/drive/download/)  
2. Sign in: Use project account `jmithominii@gmail.com` (has 100 GB storage)

### **Upload Process**

1. **Upload JPG files:**  
   * Navigate to: `Ithomiini_Ikiam → Photos → Photos wings of collected butterflies → JPG_photos`  
   * Sort by file type to separate JPG from RAW files  
   * Upload only renamed JPG files (avoid files like IMG\_0123.JPG)  
2. **Upload RAW files:**  
   * Navigate to: `Photos wings of collected butterflies → Raw_photos`  
   * Upload renamed RAW files  
3. Wait for upload completion before proceeding to database update

## **Database Integration**

### **Update Photo\_links Sheet**

1. Open spreadsheet: [Ithomiini\_Ecuador\_2022-23 MeierGroup](https://docs.google.com/spreadsheets/d/1QZj6YgHAJ9NmFXFPCtu-i-1NDuDmAdMF2Wogts7S2_4/edit?usp=drive_link)  
2. **Run file listing script:**  
   * Go to menu: `List Files/Folders → List All Files and Folders`  
   * Grant Google Drive permissions when prompted (needed for capture date reading)  
   * Enter folder codes: `1, 6` (corresponds to JPG\_photos and Raw\_photos folders)  
3. **Custom folders (if needed):**  
   * For new folders (e.g., PERU\_2024), copy folder ID from browser URL  
   * Example: `https://drive.google.com/drive/folders/11BaM_5YMdE88GnqNt-icJWSdeK5xf6gK`  
   * Folder ID: `11BaM_5YMdE88GnqNt-icJWSdeK5xf6gK`  
4. **Script execution:**  
   * Script uses LongRun library to handle Google's 6-minute runtime limit  
   * Automatically processes all files and subfolders (excludes folders ending with '\_temp')  
   * Adds hyperlinks to photos in corresponding individual rows

### **Final Database Update**

1. Update web application: Visit [wings.gallery.info.gf](http://wings.gallery.info.gf/)  
2. Click "Update database" button to download new photo links  
3. Verify functionality: Test filtering and photo display on website



