#pragma once

#import <VisionCamera/FrameProcessorPlugin.h>
#import <VisionCamera/VisionCameraProxyHolder.h>

@interface ArucoDetectorPlugin : FrameProcessorPlugin

- (instancetype _Nonnull)initWithProxy:(VisionCameraProxyHolder* _Nonnull)proxy
                           withOptions:(NSDictionary* _Nullable)options;

@end
