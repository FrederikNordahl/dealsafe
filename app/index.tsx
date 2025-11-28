import { LiquidGlassView, isLiquidGlassSupported } from '@callstack/liquid-glass';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import { Image as ExpoImage } from 'expo-image';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import * as Notifications from 'expo-notifications';
import { useShareIntentContext } from 'expo-share-intent';
import { Archive, Camera, FilePlus, ImageUp, Plus, Search, Trash2, User as UserIcon } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ListRenderItem } from 'react-native';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  PlatformColor,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import OtpScreen from '../components/auth/OtpScreen';
import PhoneNumberScreen from '../components/auth/PhoneNumberScreen';
import { AuthStorage, type User } from '../utils/auth';

const API_URL = 'https://dealsafe-backend.vercel.app';

type UsageGuide = {
  raw: string;
  steps: string[];
};

type Voucher = {
  id: number;
  file_url: string;
  file_type: string;
  original_filename: string;
  file_size: number;
  number_of_persons: number | null;
  redemption_method: string | null;
  redemption_value: string | null;
  description: string | null;
  expires_at: string | null;
  is_valid: boolean;
  rejection_reason: string | null;
  confidence_score: number | null;
  usage_guide: UsageGuide | null;
  created_at: string;
  updated_at: string;
};

type Attachment = {
  id: string;
  name: string;
  uri: string;
  type: string;
};

export default function App() {
  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [authStep, setAuthStep] = useState<'phone' | 'otp'>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [errorModal, setErrorModal] = useState<{ title: string; message: string } | null>(null);
  const [showNotificationReminderModal, setShowNotificationReminderModal] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(new Set());
  const [recentPhotos, setRecentPhotos] = useState<MediaLibrary.Asset[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingVouchers, setIsLoadingVouchers] = useState(true);
  const [expandedVoucherId, setExpandedVoucherId] = useState<number | null>(null);
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['50%'], []);
  const insets = useSafeAreaInsets();
  const uploadProgress = useRef(new Animated.Value(0)).current;
  const { hasShareIntent, shareIntent, resetShareIntent, error } = useShareIntentContext();
  
  // Refs to prevent duplicate processing of share intents
  const processingShareIntent = useRef(false);
  const lastProcessedShareIntentId = useRef<string | null>(null);
  const authChecked = useRef(false);

  // Check auth on mount
  useEffect(() => {
    if (authChecked.current) return;
    authChecked.current = true;
    
    const checkAuth = async () => {
      try {
        const token = await AuthStorage.getToken();
        const user = await AuthStorage.getUser();
        
        if (token && user) {
          setAuthToken(token);
          setIsAuthenticated(true);
        }
      } catch (error) {
        console.error('Auth check error:', error);
      } finally {
        setIsCheckingAuth(false);
      }
    };

    checkAuth();
  }, []);

  // Auth handlers
  const handleOtpRequested = useCallback((phone: string) => {
    setPhoneNumber(phone);
    setAuthStep('otp');
  }, []);

  const handleOtpVerified = useCallback(async (token: string, user: User) => {
    try {
      await AuthStorage.setToken(token);
      await AuthStorage.setUser(user);
      setAuthToken(token);
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Save auth error:', error);
      Alert.alert('Error', 'Failed to save authentication');
    }
  }, []);

  const handleBackToPhone = useCallback(() => {
    setAuthStep('phone');
  }, []);

  const handleLogout = useCallback(() => {
    setShowLogoutModal(true);
  }, []);

  const showError = useCallback((title: string, message: string) => {
    setErrorModal({ title, message });
  }, []);

  const closeErrorModal = useCallback(() => {
    setErrorModal(null);
  }, []);

  const confirmLogout = useCallback(async () => {
    try {
      await AuthStorage.clear();
      setIsAuthenticated(false);
      setAuthToken(null);
      setAuthStep('phone');
      setVouchers([]);
      setShowLogoutModal(false);
    } catch (error) {
      console.error('Logout error:', error);
      showError('Error', 'Failed to log out');
    }
  }, [showError]);

  const cancelLogout = useCallback(() => {
    setShowLogoutModal(false);
  }, []);

  // Notification handling
  const NOTIFICATION_PERMISSION_ASKED_KEY = 'dealsafe_notification_permission_asked';

  const checkNotificationPermissionAsked = useCallback(async () => {
    try {
      const asked = await AsyncStorage.getItem(NOTIFICATION_PERMISSION_ASKED_KEY);
      return asked === 'true';
    } catch (error) {
      console.error('Error checking notification permission asked:', error);
      return false;
    }
  }, []);

  const markNotificationPermissionAsked = useCallback(async () => {
    try {
      await AsyncStorage.setItem(NOTIFICATION_PERMISSION_ASKED_KEY, 'true');
    } catch (error) {
      console.error('Error marking notification permission asked:', error);
    }
  }, []);

  const registerNotificationToken = useCallback(async (token: string) => {
    if (!authToken) return;

    try {
      let deviceName = 'Unknown Device';
      if (Platform.OS === 'ios') {
        const iosConstants = Platform.constants as any;
        deviceName = `${iosConstants.systemName || 'iOS'} ${iosConstants.osVersion || ''}`.trim();
      } else if (Platform.OS === 'android') {
        const androidConstants = Platform.constants as any;
        deviceName = `${androidConstants.Brand || 'Android'} ${androidConstants.Release || ''}`.trim();
      }

      const response = await fetch(`${API_URL}/api/notifications/register-token`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          platform: Platform.OS,
          device_name: deviceName,
        }),
      });

      if (!response.ok) {
        console.error('Failed to register notification token:', response.status);
      } else {
        console.log('Notification token registered successfully');
      }
    } catch (error) {
      console.error('Error registering notification token:', error);
    }
  }, [authToken]);

  const requestNotificationPermission = useCallback(async () => {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      
      if (existingStatus === 'granted') {
        // Already granted, get token and register
        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId: '1a59711e-8421-404f-9ea1-0f4a71dbf242',
        });
        await registerNotificationToken(tokenData.data);
        return;
      }

      // Request permission
      const { status } = await Notifications.requestPermissionsAsync();
      
      if (status === 'granted') {
        // Get token and register
        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId: '1a59711e-8421-404f-9ea1-0f4a71dbf242',
        });
        await registerNotificationToken(tokenData.data);
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
    }
  }, [registerNotificationToken]);

  const handleNotificationReminderYes = useCallback(async () => {
    setShowNotificationReminderModal(false);
    await markNotificationPermissionAsked();
    await requestNotificationPermission();
  }, [markNotificationPermissionAsked, requestNotificationPermission]);

  const handleNotificationReminderNo = useCallback(async () => {
    setShowNotificationReminderModal(false);
    await markNotificationPermissionAsked();
  }, [markNotificationPermissionAsked]);

  const showNotificationReminderModalIfNeeded = useCallback(async () => {
    const hasBeenAsked = await checkNotificationPermissionAsked();
    if (!hasBeenAsked) {
      setShowNotificationReminderModal(true);
    }
  }, [checkNotificationPermissionAsked]);

  // Fetch vouchers from API
  const fetchVouchers = useCallback(async () => {
    if (!authToken) return;
    
    try {
      setIsLoadingVouchers(true);
      const response = await fetch(`${API_URL}/api/vouchers?limit=100`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          await AuthStorage.clear();
          setIsAuthenticated(false);
          setAuthToken(null);
          Alert.alert('Session Expired', 'Please login again');
          return;
        }
        throw new Error('Failed to fetch vouchers');
      }

      const data = await response.json();
      
      if (data.success && Array.isArray(data.vouchers)) {
        setVouchers(data.vouchers);
      }
    } catch (error) {
      console.error('Error fetching vouchers:', error);
    } finally {
      setIsLoadingVouchers(false);
    }
  }, [authToken]);

  // Mark voucher as used
  const markVoucherAsUsed = useCallback(async (voucherId: number) => {
    if (!authToken) return;

    try {
      const response = await fetch(`${API_URL}/api/vouchers/${voucherId}/mark-used`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          await AuthStorage.clear();
          setIsAuthenticated(false);
          setAuthToken(null);
          Alert.alert('Session Expired', 'Please login again');
          return;
        }
        throw new Error('Failed to mark voucher as used');
      }

      // Refresh vouchers list
      await fetchVouchers();
    } catch (error) {
      console.error('Error marking voucher as used:', error);
      Alert.alert('Error', 'Failed to mark voucher as used');
    }
  }, [authToken, fetchVouchers]);

  // Delete voucher
  const deleteVoucher = useCallback(async (voucherId: number) => {
    if (!authToken) return;

    try {
      const response = await fetch(`${API_URL}/api/vouchers/${voucherId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          await AuthStorage.clear();
          setIsAuthenticated(false);
          setAuthToken(null);
          Alert.alert('Session Expired', 'Please login again');
          return;
        }
        throw new Error('Failed to delete voucher');
      }

      // Remove from local state immediately for better UX
      setVouchers((prev) => prev.filter((v) => v.id !== voucherId));
    } catch (error) {
      console.error('Error deleting voucher:', error);
      Alert.alert('Error', 'Failed to delete voucher');
      // Refresh vouchers list on error
      await fetchVouchers();
    }
  }, [authToken, fetchVouchers]);

  // Load vouchers when authenticated
  useEffect(() => {
    if (isAuthenticated && authToken) {
      fetchVouchers();
    }
  }, [isAuthenticated, authToken, fetchVouchers]);

  const startProgressAnimation = useCallback(() => {
    uploadProgress.setValue(0);
    // Animate to 95% over 15 seconds with ease-out (fast start, slow end)
    Animated.timing(uploadProgress, {
      toValue: 95,
      duration: 15000,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [uploadProgress]);

  const completeProgress = useCallback(() => {
    // Quickly animate to 100%
    Animated.timing(uploadProgress, {
      toValue: 100,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [uploadProgress]);

  const resetProgress = useCallback(() => {
    uploadProgress.setValue(0);
  }, [uploadProgress]);

  const uploadToAPI = useCallback(async (fileUri: string, fileName: string, mimeType?: string) => {
    if (!authToken) throw new Error('Not authenticated');
    
    try {
      // Determine the correct MIME type
      let contentType = mimeType || 'image/jpeg';
      
      // Fix MIME type if it's generic
      if (contentType === 'image' || !contentType.includes('/')) {
        const extension = fileName.toLowerCase().split('.').pop();
        switch (extension) {
          case 'jpg':
          case 'jpeg':
            contentType = 'image/jpeg';
            break;
          case 'png':
            contentType = 'image/png';
            break;
          case 'gif':
            contentType = 'image/gif';
            break;
          case 'webp':
            contentType = 'image/webp';
            break;
          case 'pdf':
            contentType = 'application/pdf';
            break;
          case 'txt':
            contentType = 'text/plain';
            break;
          default:
            contentType = 'application/octet-stream';
        }
      }

      console.log('Starting upload:', { 
        platform: Platform.OS, 
        uri: fileUri, 
        name: fileName, 
        type: contentType 
      });

      const formData = new FormData();

      // Different handling for web vs native
      if (Platform.OS === 'web') {
        // On web, we need to fetch the blob first and create a proper File object
        try {
          const response = await fetch(fileUri);
          const blob = await response.blob();
          
          // Create a proper File object (not just a blob)
          const file = new File([blob], fileName, { type: contentType });
          formData.append('file', file);
          
          console.log('Web: Created File object:', {
            name: file.name,
            size: file.size,
            type: file.type
          });
        } catch (error) {
          console.error('Failed to fetch blob from URI:', error);
          throw new Error('Failed to process file for upload');
        }
      } else {
        // On native (iOS/Android), use the URI structure
        const file: any = {
          uri: fileUri,
          name: fileName,
          type: contentType,
        };
        formData.append('file', file);
        console.log('Native: Appending file object to formData');
      }

      // Step 1: Upload file to blob storage
      console.log('Step 1: Uploading file to blob storage...');
      const uploadResponse = await fetch(`${API_URL}/api/vouchers/upload-file`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
        body: formData,
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error('Upload failed with status:', uploadResponse.status, errorText);
        throw new Error(`Upload failed: ${errorText}`);
      }

      const uploadResult = await uploadResponse.json();
      console.log('File uploaded:', uploadResult.file);

      // Step 2: Analyze the uploaded file with AI
      console.log('Step 2: Analyzing file with AI...');
      const analyzeResponse = await fetch(`${API_URL}/api/vouchers/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          fileUrl: uploadResult.file.url,
          filename: uploadResult.file.filename,
          mimeType: uploadResult.file.mimeType,
          size: uploadResult.file.size,
        }),
      });

      console.log('analyzeResponse', analyzeResponse);

      if (!analyzeResponse.ok) {
        let errorData;
        try {
          errorData = await analyzeResponse.json();
        } catch {
          const errorText = await analyzeResponse.text();
          console.error('Analysis failed with status:', analyzeResponse.status, errorText);
          throw new Error(`Analysis failed: ${errorText}`);
        }
        
        console.error('Analysis failed:', errorData);
        
        // Create a structured error with message as title and hint as body
        const error = new Error(errorData.message || 'Analysis failed');
        (error as any).hint = errorData.hint || '';
        throw error;
      }

      const analyzeResult = await analyzeResponse.json();
      console.log('Analysis complete:', analyzeResult.voucher);

      if (analyzeResult.success && analyzeResult.voucher) {
        return analyzeResult.voucher as Voucher;
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      console.error('Upload error:', error);
      throw error;
    }
  }, [authToken]);

  const downloadAndUploadURL = useCallback(async (url: string) => {
    if (!authToken) throw new Error('Not authenticated');
    
    try {
      console.log('Step 1: Downloading content from URL:', url);
      
      // Send URL directly to backend - backend will download and process it
      const response = await fetch(`${API_URL}/api/vouchers/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ url }),
      });
      
      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          const errorText = await response.text();
          console.error('Upload failed with status:', response.status, errorText);
          throw new Error(`Upload failed: ${errorText}`);
        }
        
        console.error('Upload failed:', errorData);
        
        // Create a structured error with message as title and hint as body
        const error = new Error(errorData.message || 'Upload failed');
        (error as any).hint = errorData.hint || '';
        throw error;
      }

      const result = await response.json();
      console.log('Upload and analysis complete:', result);

      if (result.success && result.voucher) {
        return result.voucher as Voucher;
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      console.error('Error in downloadAndUploadURL:', error);
      // Re-throw with more context
      if (error instanceof Error) {
        throw new Error(`Upload failed: ${error.message}`);
      } else {
        throw new Error('Upload failed: Unknown error');
      }
    }
  }, [authToken]);

  const uploadFiles = useCallback(async (files: Attachment[]) => {
    if (files.length === 0) return;

    setIsUploading(true);
    startProgressAnimation();
    const uploadedVouchers: Voucher[] = [];
    const errors: { name: string; message: string; hint: string }[] = [];

    try {
      for (const file of files) {
        try {
          const voucher = await uploadToAPI(file.uri, file.name, file.type);
          uploadedVouchers.push(voucher);
        } catch (error) {
          const err = error as any;
          const title = err.message || 'Upload failed';
          const hint = err.hint || '';
          const fullMessage = hint ? `${hint}` : '';
          errors.push({ name: file.name, message: title, hint: fullMessage });
        }
      }

      if (uploadedVouchers.length > 0) {
        // Complete the progress bar
        completeProgress();
        
        // Refetch all vouchers to get the latest from the API
        await fetchVouchers();
        
        // Show notification reminder modal instead of success alert
        await showNotificationReminderModalIfNeeded();
      }

      if (errors.length > 0) {
        // Show detailed error for single file, or list for multiple
        if (errors.length === 1) {
          showError(errors[0].message, errors[0].hint);
        } else {
          const errorList = errors.map(e => {
            if (e.hint) {
              return `${e.name}:\n${e.message}\n${e.hint}`;
            }
            return `${e.name}:\n${e.message}`;
          }).join('\n\n');
          showError('Upload Errors', errorList);
        }
      }
    } finally {
      setTimeout(() => {
        setIsUploading(false);
        resetProgress();
      }, 500);
    }
  }, [uploadToAPI, fetchVouchers, startProgressAnimation, completeProgress, resetProgress, showError, showNotificationReminderModalIfNeeded]);

  // Handle shared files/URLs from other apps
  useEffect(() => {
    console.log('Share Intent State:', { hasShareIntent, shareIntent, error });
    
    // Early return if already processing or no share intent
    if (!hasShareIntent || !shareIntent || processingShareIntent.current) {
      if (error) {
        console.error('Share intent error:', error);
        Alert.alert('Share Error', `Failed to receive shared content: ${error}`);
      }
      return;
    }
    
    // Create a unique ID for this share intent to prevent duplicate processing
    const shareIntentId = JSON.stringify({
      text: shareIntent.text,
      webUrl: shareIntent.webUrl,
      files: shareIntent.files?.map((f: any) => f.path || f.uri),
      timestamp: Date.now()
    });
    
    // Check if we've already processed this exact share intent
    if (lastProcessedShareIntentId.current === shareIntentId) {
      console.log('Share intent already processed, skipping');
      return;
    }
    
    // Mark as processing and store the ID
    processingShareIntent.current = true;
    lastProcessedShareIntentId.current = shareIntentId;
    
    // Reset share intent immediately to prevent re-triggering
    resetShareIntent();
    
    // Handle shared URLs or text
    if (shareIntent.text || shareIntent.webUrl) {
      const sharedUrl = shareIntent.webUrl || shareIntent.text;
      console.log('Received shared URL:', sharedUrl);
      
      // Check if it's a valid URL
      if (sharedUrl && (sharedUrl.startsWith('http://') || sharedUrl.startsWith('https://'))) {
        setIsUploading(true);
        startProgressAnimation();
        
        downloadAndUploadURL(sharedUrl)
          .then(async (voucher) => {
            completeProgress();
            setVouchers((prev) => [voucher, ...prev]);
            // Show notification reminder modal instead of success alert
            await showNotificationReminderModalIfNeeded();
          })
          .catch((err) => {
            resetProgress();
            console.error('Failed to download and upload URL:', err);
            const error = err as any;
            const title = error.message || 'Upload failed';
            const hint = error.hint || '';
            showError(title, hint);
          })
          .finally(() => {
            setIsUploading(false);
            processingShareIntent.current = false;
          });
      } else {
        Alert.alert('Invalid URL', 'The shared content is not a valid URL.');
        processingShareIntent.current = false;
      }
    }
    // Handle shared files
    else if (shareIntent.files && shareIntent.files.length > 0) {
      console.log('Received shared files:', JSON.stringify(shareIntent.files, null, 2));
      
      const attachments: Attachment[] = shareIntent.files.map((file: any, index: number) => ({
        id: `${Date.now()}-${index}`,
        name: file.fileName || file.name || `shared-file-${index}`,
        uri: file.path || file.uri || '',
        type: file.mimeType || file.type || 'application/octet-stream',
      }));

      console.log('Processed attachments:', attachments);

      // Upload the shared files
      uploadFiles(attachments)
        .finally(() => {
          processingShareIntent.current = false;
        });
    } else {
      processingShareIntent.current = false;
    }
  }, [hasShareIntent, shareIntent, error, resetShareIntent, uploadFiles, downloadAndUploadURL, startProgressAnimation, completeProgress, resetProgress, showError, showNotificationReminderModalIfNeeded]);

  // Convert images to JPEG for better compatibility and smaller file sizes
  const convertImageToJPEG = useCallback(async (uri: string, originalName: string) => {
    try {
      console.log('Converting image to JPEG:', uri);
      const manipResult = await ImageManipulator.manipulateAsync(
        uri,
        [], // no transformations, just format conversion
        {
          compress: 0.8, // 80% quality - good balance between quality and file size
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );
      
      // Generate new filename with .jpg extension
      const nameWithoutExt = originalName.replace(/\.[^/.]+$/, '');
      const newName = `${nameWithoutExt}.jpg`;
      
      console.log('Image converted successfully:', manipResult.uri);
      return { uri: manipResult.uri, name: newName };
    } catch (error) {
      console.error('Failed to convert image:', error);
      // If conversion fails, return original
      return { uri, name: originalName };
    }
  }, []);

  const handleTakePhoto = useCallback(async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();

    if (permissionResult.granted === false) {
      if (permissionResult.canAskAgain === false) {
        Alert.alert(
          'Camera Permission Required',
          'Camera access is needed to take photos. Please enable it in your device settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
        );
      } else {
        Alert.alert('Permission required', 'Camera permission is required to take photos');
      }
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 1,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      // Convert images to JPEG format
      const convertedAssets = await Promise.all(
        result.assets.map(async (asset) => {
          const originalName = asset.uri.split('/').pop() ?? 'photo.jpg';
          const converted = await convertImageToJPEG(asset.uri, originalName);
          return {
            ...asset,
            uri: converted.uri,
            name: converted.name,
          };
        })
      );

      const newAttachments: Attachment[] = convertedAssets.map((asset) => ({
        id: `${Date.now()}-${asset.uri}`,
        name: asset.name,
        uri: asset.uri,
        type: 'image/jpeg',
      }));
      await uploadFiles(newAttachments);
    }
  }, [uploadFiles, convertImageToJPEG]);

  const handleChoosePhoto = useCallback(async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permissionResult.granted === false) {
      if (permissionResult.canAskAgain === false) {
        Alert.alert(
          'Photo Library Permission Required',
          'Photo library access is needed to select photos. Please enable it in your device settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
        );
      } else {
        Alert.alert('Permission required', 'Media library permission is required to choose photos');
      }
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      quality: 1,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      // Convert images to JPEG, leave videos as-is
      const convertedAssets = await Promise.all(
        result.assets.map(async (asset) => {
          const originalName = asset.uri.split('/').pop() ?? 'unnamed';
          
          // Only convert images, not videos
          if (asset.type === 'image') {
            const converted = await convertImageToJPEG(asset.uri, originalName);
            return {
              ...asset,
              uri: converted.uri,
              name: converted.name,
              type: 'image/jpeg',
            };
          }
          
          // Return videos unchanged
          return {
            ...asset,
            name: originalName,
            type: asset.type ?? 'video',
          };
        })
      );

      const newAttachments: Attachment[] = convertedAssets.map((asset) => ({
        id: `${Date.now()}-${asset.uri}`,
        name: asset.name,
        uri: asset.uri,
        type: asset.type ?? 'image',
      }));
      await uploadFiles(newAttachments);
    }
  }, [uploadFiles, convertImageToJPEG]);

  const handleChooseFile = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        multiple: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const mapped: Attachment[] = result.assets.map((asset) => ({
          id: `${asset.size ?? Date.now()}-${asset.uri}`,
          name: asset.name ?? 'unnamed',
          uri: asset.uri,
          type: asset.mimeType ?? 'application/octet-stream',
        }));
        await uploadFiles(mapped);
      }
    } catch (error) {
      Alert.alert('File picker error', (error as Error).message);
    }
  }, [uploadFiles]);

  const loadRecentPhotos = useCallback(async () => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Media library permission is required to show recent photos');
        return;
      }

      const result = await MediaLibrary.getAssetsAsync({
        first: 20,
        mediaType: 'photo',
        sortBy: MediaLibrary.SortBy.creationTime,
      });

      setRecentPhotos(result.assets);
    } catch (error) {
      // Silently handle error in production
      if (__DEV__) {
        console.error('Error loading recent photos:', error);
      }
    }
  }, []);

  const openPickerSheet = useCallback(() => {
    setSelectedPhotoIds(new Set());
    bottomSheetRef.current?.expand();
    loadRecentPhotos();
  }, [loadRecentPhotos]);

  const closePickerModal = useCallback(() => {
    bottomSheetRef.current?.close();
    setSelectedPhotoIds(new Set());
  }, []);

  const togglePhotoSelection = useCallback((photoId: string) => {
    setSelectedPhotoIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(photoId)) {
        newSet.delete(photoId);
      } else {
        newSet.add(photoId);
      }
      return newSet;
    });
  }, []);

  const handleUploadSelected = useCallback(async () => {
    if (selectedPhotoIds.size > 0) {
      // Convert selected photo IDs to attachments
      const selectedPhotosArray = recentPhotos.filter(photo => selectedPhotoIds.has(photo.id));
      
      // Convert images to JPEG format
      const convertedPhotos = await Promise.all(
        selectedPhotosArray.map(async (photo) => {
          const converted = await convertImageToJPEG(photo.uri, photo.filename);
          return {
            ...photo,
            uri: converted.uri,
            filename: converted.name,
          };
        })
      );
      
      const newAttachments: Attachment[] = convertedPhotos.map(photo => ({
        id: photo.id,
        name: photo.filename,
        uri: photo.uri,
        type: 'image/jpeg',
      }));
      closePickerModal();
      await uploadFiles(newAttachments);
    } else {
      closePickerModal();
    }
  }, [selectedPhotoIds, recentPhotos, closePickerModal, uploadFiles, convertImageToJPEG]);

  const handleOptionPress = useCallback(
    (action: () => void | Promise<void>) => {
      closePickerModal();
      setTimeout(() => {
        void action();
      }, 300);
    },
    [closePickerModal]
  );

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.85} pressBehavior="close" />
    ),
    []
  );

  const renderBackground = useCallback(
    () => (
      <LiquidGlassView
        style={[
          styles.bottomSheetBackground,
          !isLiquidGlassSupported && styles.bottomSheetBackgroundFallback,
        ]}
        effect="clear"
        interactive={false}
        colorScheme="dark"
      />
    ),
    []
  );

  const formatDate = useCallback((dateString: string | null) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('da-DK', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    });
  }, []);

  const toggleVoucherExpansion = useCallback((voucherId: number) => {
    setExpandedVoucherId((prev) => (prev === voucherId ? null : voucherId));
  }, []);

  const openVoucherUrl = useCallback(async (url: string) => {
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', 'Cannot open this voucher');
      }
    } catch {
      Alert.alert('Error', 'Failed to open voucher');
    }
  }, []);

  // Render swipe actions (archive and delete)
  const renderRightActions = useCallback((item: Voucher, progress: Animated.AnimatedInterpolation<number>) => {
    // Archive appears first (green)
    const archiveTrans = progress.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [100, 100, 0],
    });

    // Delete appears after archive (red)
    const deleteTrans = progress.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [100, 0, 0],
    });

    return (
      <View style={styles.swipeActionsContainer}>
        {/* Archive action (green) - appears first */}
        <Animated.View
          style={[
            styles.swipeAction,
            styles.swipeActionArchive,
            {
              transform: [{ translateX: archiveTrans }],
            },
          ]}>
          <TouchableOpacity
            style={styles.swipeActionButton}
            onPress={async () => {
              await markVoucherAsUsed(item.id);
            }}
            activeOpacity={0.8}>
            <Archive size={24} color="#FFFFFF" strokeWidth={2} />
            <Text style={styles.swipeActionText}>Markér som brugt</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Delete action (red) - appears when swiping more */}
        <Animated.View
          style={[
            styles.swipeAction,
            styles.swipeActionDelete,
            {
              transform: [{ translateX: deleteTrans }],
            },
          ]}>
          <TouchableOpacity
            style={styles.swipeActionButton}
            onPress={async () => {
              Alert.alert(
                'Delete Voucher',
                'Are you sure you want to delete this voucher?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                      await deleteVoucher(item.id);
                    },
                  },
                ]
              );
            }}
            activeOpacity={0.8}>
            <Trash2 size={24} color="#FFFFFF" strokeWidth={2} />
            <Text style={styles.swipeActionText}>Slet</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  }, [markVoucherAsUsed, deleteVoucher]);

  const renderVoucher = useCallback<ListRenderItem<Voucher>>(({ item }) => {
    const redemptionText = item.redemption_value 
      ? `${item.redemption_method?.toUpperCase()}: ${item.redemption_value}`
      : item.redemption_method?.toUpperCase() || 'N/A';
    
    const isExpanded = expandedVoucherId === item.id;

    return (
      <Swipeable
        renderRightActions={(progress) => renderRightActions(item, progress)}
        rightThreshold={40}
        overshootRight={false}>
        <TouchableOpacity 
          style={styles.dealCard} 
          onPress={() => toggleVoucherExpansion(item.id)}
          activeOpacity={0.7}
        >
        <View style={styles.voucherHeader}>
          <Text style={styles.dealTitle} numberOfLines={isExpanded ? undefined : 2}>
            {item.description || item.original_filename}
          </Text>
        </View>

        <View style={styles.dealMeta}>
          <View style={styles.dealMetaBlock}>
            <Text style={styles.dealMetaLabel}>Persons</Text>
            <Text style={styles.dealMetaValue}>
              {item.number_of_persons || 'N/A'}
            </Text>
          </View>

          <View style={styles.dealMetaBlock}>
            <Text style={[styles.dealMetaLabel, styles.alignRight]}>Redemption</Text>
            <Text style={[styles.dealMetaValue, styles.alignRight]} numberOfLines={1}>
              {redemptionText}
            </Text>
          </View>
        </View>

        <View style={styles.dealMeta}>
          <View style={styles.dealMetaBlock}>
            <Text style={styles.dealMetaLabel}>Added</Text>
            <Text style={styles.dealMetaValue}>{formatDate(item.created_at)}</Text>
          </View>

          <View style={styles.dealMetaBlock}>
            <Text style={[styles.dealMetaLabel, styles.alignRight]}>Expiry date</Text>
            <Text style={styles.dealMetaValue}>{formatDate(item.expires_at)}</Text>
          </View>
        </View>

        {isExpanded && (
          <>
            {item.usage_guide && item.usage_guide.steps.length > 0 && (
              <View style={styles.usageGuide}>
                <Text style={styles.usageGuideTitle}>How to redeem:</Text>
                {item.usage_guide.steps.map((step, index) => (
                  <Text key={index} style={styles.usageGuideStep}>
                    {index + 1}. {step}
                  </Text>
                ))}
              </View>
            )}

            <TouchableOpacity 
              style={styles.showVoucherButton}
              onPress={(e) => {
                e.stopPropagation();
                openVoucherUrl(item.file_url);
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.showVoucherButtonText}>Show voucher</Text>
            </TouchableOpacity>
          </>
        )}
      </TouchableOpacity>
      </Swipeable>
    );
  }, [formatDate, expandedVoucherId, toggleVoucherExpansion, openVoucherUrl, renderRightActions]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#010101" translucent={false} />
      
      {/* Loading State */}
      {isCheckingAuth && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFFFFF" />
        </View>
      )}

      {/* Auth Screens */}
      {!isCheckingAuth && !isAuthenticated && (
        <>
          {authStep === 'phone' ? (
            <PhoneNumberScreen 
              onOtpRequested={handleOtpRequested}
              apiUrl={API_URL}
            />
          ) : (
            <OtpScreen
              phoneNumber={phoneNumber}
              onVerified={handleOtpVerified}
              onBack={handleBackToPhone}
              apiUrl={API_URL}
            />
          )}
        </>
      )}

      {/* Main App */}
      {!isCheckingAuth && isAuthenticated && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoidingView}
          keyboardVerticalOffset={0}>
          <View style={styles.innerContainer}>
            <ScrollView
              contentContainerStyle={[
                styles.contentContainer,
                { paddingTop: insets.top + 16 }
              ]}
              keyboardShouldPersistTaps="handled">
              <View style={styles.headerContainer}>
                <Text style={styles.headerText}>Your deals</Text>
                <TouchableOpacity 
                  style={styles.logoutButton}
                  onPress={handleLogout}
                  activeOpacity={0.7}>
                  <UserIcon size={22} color="#FFFFFF" strokeWidth={2} />
                </TouchableOpacity>
              </View>

            {isUploading && (
              <View style={styles.uploadingIndicator}>
                <View style={styles.progressBarContainer}>
                  <Animated.View 
                    style={[
                      styles.progressBarFill,
                      {
                        width: uploadProgress.interpolate({
                          inputRange: [0, 100],
                          outputRange: ['0%', '100%'],
                        }),
                      },
                    ]} 
                  />
                </View>
                <Text style={styles.uploadingText}>Uploading and analyzing...</Text>
              </View>
            )}


            {isLoadingVouchers && vouchers.length === 0 && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#FFFFFF" />
                <Text style={styles.loadingText}>Loading vouchers...</Text>
              </View>
            )}

            {!isLoadingVouchers && vouchers.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateTitle}>No vouchers yet</Text>
                <Text style={styles.emptyStateText}>
                  Tap the + button below to upload your first voucher
                </Text>
              </View>
            )}

            {vouchers.length > 0 && (
              <View style={styles.vouchersSection}>
                {vouchers.map((voucher) => (
                  <View key={voucher.id} style={styles.voucherWrapper}>
                    {renderVoucher({ item: voucher, index: 0, separators: {} as any })}
                  </View>
                ))}
              </View>
            )}
            </ScrollView>

            <LiquidGlassView
              effect="clear"
              interactive={false}
              colorScheme="dark"
              style={[
                styles.bottomBar,
                !isLiquidGlassSupported && styles.bottomBarFallback,
              ]}>
              <TouchableOpacity style={styles.addButton} onPress={openPickerSheet} activeOpacity={0.8}>
                <Plus size={16} color="#010101" strokeWidth={2.5} />
              </TouchableOpacity>

              <View style={styles.searchBar}>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search deal"
                  placeholderTextColor={'rgba(0, 0, 0, 0.8)'}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                <Search 
                  size={20} 
                  color={ 'rgba(0, 0, 0, 0.8)'} 
                  strokeWidth={2}
                />
              </View>
            </LiquidGlassView>
          </View>
        </KeyboardAvoidingView>
      )}

      {/* Bottom Sheet - Only when authenticated */}
      {!isCheckingAuth && isAuthenticated && (
        <View style={[styles.bottomSheetWrapper, { paddingBottom: insets.bottom + 8 }]} pointerEvents="box-none">
          <BottomSheet
            ref={bottomSheetRef}
            index={-1}
            snapPoints={snapPoints}
            enablePanDownToClose
            backdropComponent={renderBackdrop}
            backgroundComponent={renderBackground}
            handleIndicatorStyle={styles.bottomSheetIndicator}>
            <BottomSheetView style={styles.bottomSheetContent}>
            <View style={styles.recentPhotosSection}>
            <TouchableOpacity style={styles.openAllPhotos} onPress={() => handleOptionPress(handleChoosePhoto)}>
                <Text style={styles.openAllPhotosText}>Open all photos</Text>
              </TouchableOpacity>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photosRow}>
                <TouchableOpacity style={styles.addPhotoButton} onPress={() => handleOptionPress(handleChoosePhoto)}>
                  <Plus size={16} color="#FFFFFF" strokeWidth={2.5} />
                </TouchableOpacity>
                {recentPhotos.slice(0, 8).map((photo) => {
                  const isSelected = selectedPhotoIds.has(photo.id);
                  return (
                    <TouchableOpacity
                      key={photo.id}
                      style={[styles.photoThumbnail, isSelected && styles.photoThumbnailSelected]}
                      onPress={() => togglePhotoSelection(photo.id)}
                      activeOpacity={0.7}>
                      <ExpoImage 
                        source={{ uri: photo.uri }} 
                        style={styles.photoImage}
                        contentFit="cover"
                      />
                      {isSelected && (
                        <View style={styles.photoSelectionBadge} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            <View style={styles.optionsList}>
              <TouchableOpacity style={styles.optionItem} onPress={() => handleOptionPress(handleTakePhoto)}>
                <View style={styles.optionIcon}>
                  <Camera size={24} color="#FFFFFF" />
                </View>
                <View style={styles.optionTextContainer}>
                  <Text style={styles.optionTitle}>Take a photo</Text>
                  <Text style={styles.optionDescription}>Use your phone to take and upload an image</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.optionItem} onPress={() => handleOptionPress(handleChoosePhoto)}>
                <View style={styles.optionIcon}>
                  <ImageUp size={24} color="#FFFFFF" />
                </View>
                <View style={styles.optionTextContainer}>
                  <Text style={styles.optionTitle}>Upload image</Text>
                  <Text style={styles.optionDescription}>Upload an image from your phone</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.optionItem} onPress={() => handleOptionPress(handleChooseFile)}>
                <View style={styles.optionIcon}>
                  <FilePlus size={24} color="#FFFFFF" />
                </View>
                <View style={styles.optionTextContainer}>
                  <Text style={styles.optionTitle}>Upload file</Text>
                  <Text style={styles.optionDescription}>Upload a file from your phone</Text>
                </View>
              </TouchableOpacity>
            </View>

            {selectedPhotoIds.size > 0 && (
              <TouchableOpacity
                style={styles.uploadButton}
                onPress={handleUploadSelected}>
                <Text style={styles.uploadButtonText}>
                  Upload {selectedPhotoIds.size} {selectedPhotoIds.size === 1 ? 'image' : 'images'}
                </Text>
              </TouchableOpacity>
              )}
            </BottomSheetView>
          </BottomSheet>
        </View>
      )}

      {/* Logout Modal */}
      <Modal
        visible={showLogoutModal}
        transparent
        animationType="fade"
        onRequestClose={cancelLogout}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Log Out</Text>
            <Text style={styles.modalMessage}>
              Are you sure you want to log out?
            </Text>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={cancelLogout}
                activeOpacity={0.8}>
                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonLogout]}
                onPress={confirmLogout}
                activeOpacity={0.8}>
                <Text style={styles.modalButtonTextLogout}>Log Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Error Modal */}
      <Modal
        visible={errorModal !== null}
        transparent
        animationType="fade"
        onRequestClose={closeErrorModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{errorModal?.title}</Text>
            <Text style={styles.modalMessage}>{errorModal?.message}</Text>
            
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonSingle]}
              onPress={closeErrorModal}
              activeOpacity={0.8}>
              <Text style={styles.modalButtonTextLogout}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Notification Reminder Modal */}
      <Modal
        visible={showNotificationReminderModal}
        transparent
        animationType="fade"
        onRequestClose={handleNotificationReminderNo}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Reminder</Text>
            <Text style={styles.modalMessage}>
              Would you like us to remind you when the voucher is about to expire?
            </Text>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={handleNotificationReminderNo}
                activeOpacity={0.8}>
                <Text style={styles.modalButtonTextCancel}>No</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonLogout]}
                onPress={handleNotificationReminderYes}
                activeOpacity={0.8}>
                <Text style={styles.modalButtonTextLogout}>Yes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#010101',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  innerContainer: {
    flex: 1,
    backgroundColor: '#010101',
  },
  contentContainer: {
    paddingBottom: 160,
    paddingHorizontal: 12,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    marginTop: 16,
  },
  headerText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  logoutButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#202020',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dealCard: {
    padding: 24,
    borderRadius: 28,
    backgroundColor: '#202020',
    gap: 16,
  },
  dealTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  dealMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 24,
  },
  dealMetaBlock: {
    flexShrink: 1,
    gap: 4,
  },
  dealMetaLabel: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    letterSpacing: 0.3,
  },
  dealMetaValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  alignRight: {
    textAlign: 'right',
  },
  bottomBar: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 40,
    paddingVertical: 12,
    paddingHorizontal: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(32, 32, 32, 0.5)',
  },
  bottomBarFallback: {
    backgroundColor: 'rgba(32, 32, 32, 0.95)',
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonLabel: {
    fontSize: 24,
    fontWeight: '600',
    color: '#010101',
    position: 'relative',
    bottom: 1,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 24,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Platform.OS === 'ios' ? PlatformColor('labelColor') : '#000000',
    padding: 0,
  },
  bottomSheetWrapper: {
    position: 'absolute',
    top: 0,
    left: 6,
    right: 6,
    bottom: 0,
  },
  bottomSheetBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 96,
    borderRadius: 48,
    overflow: 'hidden',
  },
  bottomSheetBackgroundFallback: {
    backgroundColor: 'rgba(28, 28, 30, 0.95)',
  },
  bottomSheetIndicator: {
    backgroundColor: Platform.OS === 'ios' ? PlatformColor('tertiaryLabelColor') : 'rgba(255, 255, 255, 0.3)',
    width: 40,
    height: 4,
  },
  bottomSheetContent: {
    flex: 1,
    paddingHorizontal: 16,
  },
  recentPhotosSection: {
    marginBottom: 16,
  },
  photosRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 8,
  },
  addPhotoButton: {
    width: 80,
    height: 80,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoIcon: {
    fontSize: 28,
    color: 'rgba(255, 255, 255, 0.6)',
    fontWeight: '300',
  },
  photoThumbnail: {
    width: 80,
    height: 80,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    position: 'relative',
  },
  photoThumbnailSelected: {
    borderColor: '#FFFFFF',
    borderWidth: 2.5,
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  photoSelectionBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  openAllPhotos: {
    alignItems: 'flex-end',
    paddingBottom: 8,
  },
  openAllPhotosText: {
    color: Platform.OS === 'ios' ? PlatformColor('labelColor') : 'rgba(255, 255, 255, 0.9)',
    fontSize: 15,
    textDecorationLine: 'underline',
  },
  optionsList: {
    marginBottom: 12,
    gap: 2,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    gap: 8,
  },
  optionIcon: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    color: '#FFFFFF',
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Platform.OS === 'ios' ? PlatformColor('labelColor') : '#FFFFFF',
    marginBottom: 3,
  },
  optionDescription: {
    fontSize: 13,
    color: Platform.OS === 'ios' ? PlatformColor('secondaryLabelColor') : 'rgba(255, 255, 255, 0.55)',
    lineHeight: 17,
  },
  uploadButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  uploadButtonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  uploadButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  uploadingIndicator: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 20,
    marginBottom: 24,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 4,
  },
  uploadingText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  vouchersSection: {
    gap: 12,
  },
  voucherWrapper: {
    // Wrapper for individual vouchers
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  emptyState: {
    paddingVertical: 60,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    lineHeight: 22,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  voucherHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  usageGuide: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    gap: 8,
  },
  usageGuideTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 4,
  },
  usageGuideStep: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 18,
    paddingLeft: 4,
  },
  showVoucherButton: {
    marginTop: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  showVoucherButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#010101',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalContent: {
    backgroundColor: '#202020',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 340,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 22,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonCancel: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalButtonLogout: {
    backgroundColor: '#FFFFFF',
  },
  modalButtonTextCancel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalButtonTextLogout: {
    fontSize: 16,
    fontWeight: '600',
    color: '#010101',
  },
  modalButtonSingle: {
    backgroundColor: '#FFFFFF',
    marginTop: 8,
  },
  swipeActionsContainer: {
    flexDirection: 'row',
    width: 200,
    marginLeft: 12,
    gap: 8,
  },
  swipeAction: {
    width: 96,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 28,
    overflow: 'hidden',
  },
  swipeActionArchive: {
    backgroundColor: '#202020',
  },
  swipeActionDelete: {
    backgroundColor: '#FF3B30',
  },
  swipeActionButton: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  swipeActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
