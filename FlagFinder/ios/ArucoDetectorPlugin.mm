// OpenCV MUST be included first — before any ObjC headers that redefine YES/NO.
#include <opencv2/core.hpp>
#include <opencv2/imgproc.hpp>
#include <opencv2/objdetect/aruco_detector.hpp>

#import "ArucoDetectorPlugin.h"
#import <CoreVideo/CoreVideo.h>

@implementation ArucoDetectorPlugin {
  cv::aruco::ArucoDetector* _detector;
}

// Registers the plugin under the name "detectAruco" — must match the JS call:
//   VisionCameraProxy.initFrameProcessorPlugin('detectAruco', {})
VISION_EXPORT_FRAME_PROCESSOR(ArucoDetectorPlugin, detectAruco)

- (instancetype)initWithProxy:(VisionCameraProxyHolder*)proxy
                  withOptions:(NSDictionary* _Nullable)options {
  self = [super initWithProxy:proxy withOptions:options];
  if (self) {
    // DICT_ARUCO_ORIGINAL contains ID 121
    cv::aruco::Dictionary dict =
        cv::aruco::getPredefinedDictionary(cv::aruco::DICT_ARUCO_ORIGINAL);

    cv::aruco::DetectorParameters params;
    // Tuned for small / distant markers
    params.adaptiveThreshWinSizeMin      = 3;
    params.adaptiveThreshWinSizeMax      = 23;
    params.adaptiveThreshWinSizeStep     = 10;
    params.minMarkerPerimeterRate        = 0.02;
    params.maxMarkerPerimeterRate        = 4.0;
    params.polygonalApproxAccuracyRate   = 0.05;
    params.cornerRefinementMethod        = cv::aruco::CORNER_REFINE_SUBPIX;

    _detector = new cv::aruco::ArucoDetector(dict, params);
  }
  return self;
}

- (void)dealloc {
  delete _detector;
}

// Called on every camera frame from the VisionCamera worklet thread.
- (id _Nullable)callback:(Frame*)frame
           withArguments:(NSDictionary* _Nullable)arguments {

  CVPixelBufferRef pixelBuffer = CMSampleBufferGetImageBuffer(frame.buffer);
  if (!pixelBuffer) return @{ @"found": @NO };

  CVPixelBufferLockBaseAddress(pixelBuffer, kCVPixelBufferLock_ReadOnly);

  size_t width  = CVPixelBufferGetWidth(pixelBuffer);
  size_t height = CVPixelBufferGetHeight(pixelBuffer);

  cv::Mat gray;

  OSType fmt = CVPixelBufferGetPixelFormatType(pixelBuffer);

  if (fmt == kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange ||
      fmt == kCVPixelFormatType_420YpCbCr8BiPlanarFullRange) {
    // YUV: luma plane is already grayscale — cheapest possible path
    void*  lumaBase   = CVPixelBufferGetBaseAddressOfPlane(pixelBuffer, 0);
    size_t lumaStride = CVPixelBufferGetBytesPerRowOfPlane(pixelBuffer, 0);
    gray = cv::Mat((int)height, (int)width, CV_8UC1, lumaBase, lumaStride).clone();
  } else {
    // BGRA fallback
    void*  base   = CVPixelBufferGetBaseAddress(pixelBuffer);
    size_t stride = CVPixelBufferGetBytesPerRow(pixelBuffer);
    cv::Mat bgra((int)height, (int)width, CV_8UC4, base, stride);
    cv::cvtColor(bgra, gray, cv::COLOR_BGRA2GRAY);
  }

  CVPixelBufferUnlockBaseAddress(pixelBuffer, kCVPixelBufferLock_ReadOnly);

  // ── ArUco detection ────────────────────────────────────────────────────────
  std::vector<int>                              ids;
  std::vector<std::vector<cv::Point2f>>         corners, rejected;
  _detector->detectMarkers(gray, corners, ids, rejected);

  if (ids.empty()) {
    return @{ @"found": @NO };
  }

  // ── Build result array ─────────────────────────────────────────────────────
  NSMutableArray* markersOut = [NSMutableArray array];

  for (size_t i = 0; i < ids.size(); i++) {
    auto& c = corners[i];   // 4 corners: TL, TR, BR, BL (ArUco convention)

    // Marker center
    float cx = (c[0].x + c[1].x + c[2].x + c[3].x) / 4.0f;
    float cy = (c[0].y + c[1].y + c[2].y + c[3].y) / 4.0f;

    // Horizontal pixel span (used for distance estimate in JS)
    float leftX  = MIN(c[0].x, c[3].x);
    float rightX = MAX(c[1].x, c[2].x);
    float pixelWidth = rightX - leftX;

    NSArray* cornersArr = @[
      @[@(c[0].x), @(c[0].y)],
      @[@(c[1].x), @(c[1].y)],
      @[@(c[2].x), @(c[2].y)],
      @[@(c[3].x), @(c[3].y)],
    ];

    [markersOut addObject:@{
      @"id":          @(ids[i]),
      @"centerX":     @(cx),
      @"centerY":     @(cy),
      @"pixelWidth":  @(pixelWidth),
      @"frameWidth":  @((float)width),
      @"frameHeight": @((float)height),
      @"corners":     cornersArr,
    }];
  }

  return @{ @"found": @YES, @"markers": markersOut };
}

@end
