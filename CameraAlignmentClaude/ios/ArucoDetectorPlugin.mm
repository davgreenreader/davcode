// OpenCV must be included FIRST — before any ObjC headers that define YES/NO macros
#include <opencv2/core.hpp>
#include <opencv2/imgproc.hpp>
#include <opencv2/objdetect/aruco_detector.hpp>

#import "ArucoDetectorPlugin.h"
#import <CoreVideo/CoreVideo.h>

@implementation ArucoDetectorPlugin {
  cv::aruco::ArucoDetector* _detector;
}

VISION_EXPORT_FRAME_PROCESSOR(ArucoDetectorPlugin, detectAruco)

- (instancetype)initWithProxy:(VisionCameraProxyHolder*)proxy
                  withOptions:(NSDictionary* _Nullable)options {
  self = [super initWithProxy:proxy withOptions:options];
  if (self) {
    // Original ArUco dictionary — matches what js-aruco used
    cv::aruco::Dictionary dict = cv::aruco::getPredefinedDictionary(cv::aruco::DICT_ARUCO_ORIGINAL);
    cv::aruco::DetectorParameters params;
    // Tune for small/distant markers
    params.adaptiveThreshWinSizeMin = 3;
    params.adaptiveThreshWinSizeMax = 23;
    params.adaptiveThreshWinSizeStep = 10;
    params.minMarkerPerimeterRate = 0.02;  // detect very small markers
    params.maxMarkerPerimeterRate = 4.0;
    params.polygonalApproxAccuracyRate = 0.05;
    params.cornerRefinementMethod = cv::aruco::CORNER_REFINE_SUBPIX;
    _detector = new cv::aruco::ArucoDetector(dict, params);
  }
  return self;
}

- (void)dealloc {
  delete _detector;
}

- (id _Nullable)callback:(Frame*)frame withArguments:(NSDictionary* _Nullable)arguments {
  CVPixelBufferRef pixelBuffer = CMSampleBufferGetImageBuffer(frame.buffer);
  if (!pixelBuffer) return nil;

  CVPixelBufferLockBaseAddress(pixelBuffer, kCVPixelBufferLock_ReadOnly);

  size_t width  = CVPixelBufferGetWidth(pixelBuffer);
  size_t height = CVPixelBufferGetHeight(pixelBuffer);

  cv::Mat gray;

  OSType format = CVPixelBufferGetPixelFormatType(pixelBuffer);

  if (format == kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange ||
      format == kCVPixelFormatType_420YpCbCr8BiPlanarFullRange) {
    // YUV: luma plane is already grayscale
    void* lumaBase = CVPixelBufferGetBaseAddressOfPlane(pixelBuffer, 0);
    size_t lumaStride = CVPixelBufferGetBytesPerRowOfPlane(pixelBuffer, 0);
    gray = cv::Mat((int)height, (int)width, CV_8UC1, lumaBase, lumaStride).clone();
  } else {
    // BGRA fallback
    void* base = CVPixelBufferGetBaseAddress(pixelBuffer);
    size_t stride = CVPixelBufferGetBytesPerRow(pixelBuffer);
    cv::Mat bgra((int)height, (int)width, CV_8UC4, base, stride);
    cv::cvtColor(bgra, gray, cv::COLOR_BGRA2GRAY);
  }

  CVPixelBufferUnlockBaseAddress(pixelBuffer, kCVPixelBufferLock_ReadOnly);

  std::vector<int> ids;
  std::vector<std::vector<cv::Point2f>> corners, rejected;
  _detector->detectMarkers(gray, corners, ids, rejected);

  if (ids.empty()) {
    return @{ @"found": @NO };
  }

  // Return all detected markers so JS can pick ID 121 or track edges
  NSMutableArray* markersOut = [NSMutableArray array];

  for (size_t i = 0; i < ids.size(); i++) {
    auto& c = corners[i];

    // Center
    float cx = (c[0].x + c[1].x + c[2].x + c[3].x) / 4.0f;
    float cy = (c[0].y + c[1].y + c[2].y + c[3].y) / 4.0f;

    // Horizontal pixel width (left/right edges)
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
