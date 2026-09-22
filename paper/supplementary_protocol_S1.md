# Supplementary Protocol S1. Specimen photography, identifier review and publication in Wings Gallery

## S1.1 Scope and records

This protocol connects paired wing photography to reviewed filenames, shared storage and Wings Gallery. It describes the Ithomiini collection workflow, with configurable choices identified separately. It does not validate a taxonomic identification, predict sex or replace specimen curation.

The project uses a CAMID to identify each specimen and the suffixes `d` and `v` to distinguish dorsal and ventral photographs. Keep the specimen, its label and its photographs together throughout processing. Do not assign a new specimen identity solely from an AI reading.

The software instructions refer to the browser-based AI Photo Processor at commit `49fe6ed226ed4914ed793e4252b74e18cf6ad8a4` and Wings Gallery at commit `f5cb03f17f3ba639090b32fbedde6d6645ff847b`. The original photography protocol supplies the physical workflow. Its older desktop-app instructions and fixed service quotas are not required for the browser workflow below.

## S1.2 Equipment and example configuration

The documented project setup uses a Canon EOS 550D with a Canon EF-S 18–55 mm f/4–5.6 IS STM lens, supported above a flat imaging surface. The recorded working height is approximately 28 cm above the table. The zoom position is taped to reduce accidental movement. A ruler, colour reference and the specimen's labelled envelope are included in the imaging arrangement.

The archived setup record documents the following example, associated with `CAM077884v.jpg`. These values are an example configuration, not requirements for another collection. The original photograph was not available for a fresh metadata inspection during preparation of this protocol.

| Parameter | Documented example |
| :--- | :--- |
| Camera | Canon EOS 550D |
| Lens | Canon EF-S 18–55 mm f/4–5.6 IS STM |
| Working height | Approximately 28 cm above the table |
| Focal length | 33 mm |
| Exposure time | 1/100 s |
| Aperture | f/8 |
| Sensitivity | ISO 100 |
| Exposure mode | Manual |

For another group, camera model, lens, working height, exposure and lighting are configurable. Choose settings that keep the full wing surfaces and label sharp without clipping pale labels or transparent wing regions. Record the settings and the point from which working height is measured. A colour reference supports visual comparison, but its presence alone does not establish a calibrated colour workflow.

## S1.3 Prepare the imaging station

1. Secure the camera support and place the imaging board on a stable surface. Align the camera with the board. The project protocol uses a levelling aid and a marked cross to maintain placement. Keep the ruler near the lower edge of the photographed area.
2. Place the colour reference on the right and the specimen envelope or CAMID label on the left of the wing area. Keep their positions consistent within the batch so that the AI Photo Processor can crop the label region reliably.
3. Set the framing to include all photographed wings, the complete identifier and the reference objects. Check that no label or reference object covers a wing. Avoid strong shadows, glare and reflections across the label or wing surfaces.
4. Focus on the specimen plane. Inspect a magnified preview of wing detail and handwriting. The project workflow uses manual focus to reduce changes between photographs. Recheck focus when the support, board, specimen height or zoom changes.
5. Take a test photograph and inspect the saved file, not only the camera preview. Adjust the setup before starting the batch. A remote shutter or a short self-timer, such as the five-second delay in the original protocol, can reduce movement during exposure.

Lighting equipment and exact placement are configurable. The available record does not establish a particular lamp model or lighting geometry as a project requirement.

## S1.4 Photograph the dorsal and ventral surfaces

1. Confirm the CAMID against the physical specimen record. Position the dorsal, or upper, surfaces facing the camera. Keep left and right wings in a consistent arrangement, without overlaps that obscure diagnostic detail.
2. Place the corresponding label or envelope in the frame and check every character. Keep the same CAMID visible in both photographs of a pair. Correct an illegible label through the collection's curation procedure rather than guessing its contents.
3. Capture the dorsal photograph. Inspect wing completeness, focus, exposure, label legibility and reference visibility. Repeat the photograph when an error cannot be corrected without losing biological information.
4. Turn the wings over to expose the ventral, or lower, surfaces. Reposition the wings as needed to keep the same layout and avoid overlap. Do not change the specimen label. Assign the side from the photographed surface, not from the presence or absence of male hair pencils.
5. Capture and inspect the ventral photograph. Confirm that both images belong to the same specimen before moving to the next specimen.

Dorsal-first photography is the project sequence. Another collection may use a different sequence, but the sequence alone must not determine the final side label. If a surface is unavailable, record the missing view. Do not duplicate the available photograph and present it as an observed dorsal/ventral pair.

## S1.5 Transfer and organise a batch

Copy the photographs into a dated batch folder before renaming. Preserve an unmodified copy until the reviewed files and their backup have been checked. Compare the copied inventory with the camera-card inventory so that a date filter does not omit photographs from the same day or include an earlier batch accidentally.

The project organises photographs by date. The following layout is a recommended example for another installation, not a claim about the names of historical project folders:

```text
YYYY-MM-DD_batch-name/
    originals/
    reviewed_jpeg/
    raw/
    review_records/
```

Keep RAW files and their browser-viewable JPEG companions associated by their original basename. Record any missing companion. Keep the review CSV and rename log outside the image selection so that they are not processed as photographs. Folder names are configurable, but a batch should remain traceable from the original camera filenames to its final CAMIDs.

## S1.6 Process the labels with AI Photo Processor

Open the [AI Photo Processor browser interface](https://fr4nzz.github.io/rename_photos_AI/). Its [source repository and instructions](https://github.com/Fr4nzz/rename_photos_AI/tree/49fe6ed226ed4914ed793e4252b74e18cf6ad8a4) identify the supported workflow.

1. In **API Keys**, configure an authorised Gemini API key. The documented app stores keys in the local browser. Do not include keys in filenames, screenshots, exported review files or shared protocol documents. Submit only images approved for external processing.
2. In **Select & Rotate Images**, open the batch folder and select the intended files. Check filename and file-type filters and the active image count. Rotate JPEG or PNG images where necessary to establish a consistent reading orientation.
3. In **Process Images**, set the crop around the CAMID region. Check examples from across the batch, including labels near an edge or in a different position. A crop that removes part of an identifier cannot produce a reliable reading.
4. Configure the grid dimensions, merged-image size, model, prompt and number of parallel messages. These are configurable, not fixed protocol requirements. Use a small trial batch to confirm that individual characters remain readable in the composite image. Keep the prompt explicit about the identifier fields and side labels required by the collection.
5. Process the active selection. Check that failed or interrupted requests have not left photographs without readings. Use the provider's current limits rather than the historical quotas in the original protocol. Record the model and prompt used for the batch.

The browser can preview and rotate supported JPEG and PNG images. RAW files such as CR2 or ORF can participate in companion-file renaming, but direct RAW rotation requires the optional Windows backend described in the source repository. RAW rotation is optional. Do not assume that rotating a JPEG has also changed its RAW companion. Obtain any backend executable from the project's own release page and follow its documented local setup.

## S1.7 Validate identifiers, sides and filenames

Open **Review Results** and inspect the extracted fields beside the photograph thumbnails. Enlarge the original image where necessary. Review every final CAMID and side label before renaming. Pay particular attention to crossed-out labels, ambiguous `3`/`8` or `1`/`7` readings, lost leading zeros, missing readings, duplicate CAMIDs and incomplete pairs.

Resolve disagreements against the physical label and specimen record. A plausible identifier is not enough to accept a reading. If the photograph is illegible, return to the specimen or rephotograph it. Do not infer a missing digit only because it would complete a numeric sequence.

Use **Recalculate names** after correcting fields, then inspect the proposed filenames. The project convention places the side immediately after the CAMID and before the extension. For example:

```text
CAM077884d.JPG
CAM077884v.JPG
```

These two names illustrate the convention. They do not establish that both example files are present in the available archive. Preserve the `CAM` prefix and leading zeros. Use `d` only for dorsal and `v` only for ventral. A RAW companion uses the same specimen-and-side stem with its original file extension, such as `.CR2`. Another collection can configure different identifiers, but its parser and Gallery indexing rules must agree with that convention.

Before **Rename**, check that distinct photographs will not receive the same destination name. Keep repeated takes identifiable until the curator chooses the intended image. Export the reviewed CSV and retain the rename log. The app supports reversible renaming, but this does not replace an independent backup. After renaming, open a sample of files and inspect every flagged pair or collision. Confirm that the final inventory matches the approved review table.

## S1.8 Upload to shared storage

Upload the reviewed JPEGs to the appropriate shared Google Drive collection folder. Retain RAW files in the designated RAW storage rather than assuming they will be displayed in the Gallery. Use the collection's authorised account and folder permissions. Do not publish credentials or internal folder identifiers in the manuscript.

Check that the upload has finished and compare local and remote filenames and counts. Confirm that a dorsal/ventral pair still shares the same CAMID. Preserve any subfolder organisation used to distinguish collection, insectary or CRISPR material. Publication permission for a photograph must be resolved before it is made accessible through a public Gallery.

## S1.9 Index Google Drive in Google Sheets

The Gallery repository contains [`list_google_drive_files.gs`](https://github.com/rapidspeciation/Shiny_Ikiam_Wings_Gallery/blob/f5cb03f17f3ba639090b32fbedde6d6645ff847b/list_google_drive_files.gs). It lists image files into the `Photo_links` sheet, including filenames, URLs and file metadata.

For the existing project installation, use the configured spreadsheet and the **Photo Database Tools** menu to run the folder listing or synchronisation. Wait for batch processing to finish before updating the Gallery database. Check a recently uploaded CAMID, its side suffixes and its links in `Photo_links`. Do not assume that uploading to Drive has updated the spreadsheet automatically.

For a new installation, an authorised administrator should open the destination spreadsheet, choose **Extensions > Apps Script**, install the repository's listing script and its documented `LongRun.gs` dependency, enable the Drive API service and configure `FOLDER_MAPPING` with the intended folder IDs. Reload the spreadsheet to expose **Photo Database Tools** and authorise the required access. These IDs and permissions are installation-specific. Follow the [pinned Gallery setup instructions](https://github.com/rapidspeciation/Shiny_Ikiam_Wings_Gallery/blob/f5cb03f17f3ba639090b32fbedde6d6645ff847b/README.md) rather than copying another group's private configuration.

The script supports batch processing and dead-link cleaning. Inspect proposed removals against the source folders when files have been moved or access has changed. A permission failure should not be interpreted automatically as a deleted specimen photograph.

## S1.10 Update and check Wings Gallery

In [Wings Gallery](https://rapidspeciation.github.io/Shiny_Ikiam_Wings_Gallery/), open **Update DB** and use the authorised update control. In the documented deployment, a Cloudflare Worker checks the request and triggers the GitHub Actions database update. The Python processing step reads the spreadsheet, writes the Gallery JSON data and starts the subsequent deployment.

Wait for the update and deployment to finish. A submitted request is not evidence of a completed update. Search for a newly added CAMID and check both wing surfaces, the image links and the relevant collection view. Inspect records with missing views and verify that unrelated specimens have not been combined. Check the intended public access separately from access granted to a logged-in curator.

For a new installation, configure the spreadsheet access, update proxy, workflow credentials and deployment before using this step. These are administrator choices, not credentials supplied by this protocol. The Gallery README documents local processing through `scripts/process_data.py` as an alternative for an authorised maintainer.

## S1.11 Common failure checks

| Observation | Check before proceeding |
| :--- | :--- |
| Label missing from a composite | Inspect the crop and active selection against the original photograph. |
| Incorrect CAMID despite a plausible reading | Compare each character with the physical label and specimen record. |
| Duplicate destination filename | Check duplicate readings, repeated takes and incorrect side labels. Do not overwrite another specimen's file. |
| Dorsal and ventral views look identical | Inspect the original surfaces. Do not create a false pair by copying or merely rotating an image. |
| RAW file retains a different name or orientation | Check companion matching and whether the optional RAW operation was actually performed. |
| File is in Drive but absent from `Photo_links` | Check configured folders, permissions and whether the listing completed. |
| Spreadsheet is current but Gallery is not | Check the database-update workflow and subsequent deployment separately. |
| Image opens for a curator but not a reader | Check intended sharing permissions and the published image link. |
| Thumbnail or label is blurred, clipped or obscured | Rephotograph when the lost information cannot be recovered from the original file. |
| Pair points to different specimens | Stop publication of the affected record and reconcile the CAMID, side labels and source files. |

As a reproducibility recommendation, retain the original-to-final filename mapping, reviewed CSV, rename log, processing date, operator, model and prompt, software revisions and the completed Gallery update revision with each batch. These records make later corrections traceable. They are not asserted to exist for every historical batch.

## S1.12 Source materials

Physical setup and handling instructions derive from [`Photos Processing Protocol.md`](Photos%20Processing%20Protocol.md) and the author's setup description in the [archived manuscript discussion](../docs/chat-transcripts/codex-ithomiini/ithomiini-maps-manuscript-019dd1d3.md), particularly the 21 May 2026 camera and height clarification. Browser processing and database update instructions use the pinned software sources linked above. No setup photograph or interface screenshot has been reconstructed for this protocol.
