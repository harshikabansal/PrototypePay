
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats, type Html5QrcodeResult, type QrDimensions, type QrCodeErrorCallback } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAppContext } from "@/contexts/AppContext";
import { useToast } from "@/hooks/use-toast";
import { Camera, CheckCircle2, QrCode, ScanLine, XCircle, Loader2, ShieldCheck, AlertTriangle } from "lucide-react";

interface QrCodeData {
  txid: string;
  sUPI: string; 
  rUPI: string; 
  amt: number;
}

const QR_REGION_ID = "qr-code-full-region";

export function ScanQrCodeClient() {
  const { user, addLocalPendingTransaction, attemptClaimPendingTransaction, localPendingTransactions } = useAppContext();
  const { toast } = useToast();
  const [scanResultData, setScanResultData] = useState<QrCodeData | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [isScanningActive, setIsScanningActive] = useState(false);
  const [isProcessingClaim, setIsProcessingClaim] = useState(false);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | undefined>(undefined);
  const [currentLocalTxId, setCurrentLocalTxId] = useState<string | null>(null); // To store localId of scanned tx
  
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices && devices.length) {
          setCameras(devices);
          const backCamera = devices.find(device => device.label.toLowerCase().includes('back'));
          setSelectedCameraId(backCamera ? backCamera.id : devices[0].id);
        } else {
            setScanError("No cameras found on this device.");
        }
      })
      .catch((err) => {
        console.error("Error getting cameras:", err);
        let message = "Could not access camera. ";
        if (err.name === "NotAllowedError") {
            message += "Permission denied. Please allow camera access in your browser settings.";
        } else {
            message += "Please ensure permissions are granted and no other app is using the camera.";
        }
        setScanError(message);
      });
  }, []);

  const onScanFailureCallback: QrCodeErrorCallback = useCallback((errorMessage) => {
    // console.debug(`QR Scan Error (non-fatal): ${errorMessage}`); 
  },[]);

  const onScanSuccess = useCallback((decodedText: string, result: Html5QrcodeResult) => {
    setIsScanningActive(false); 
    setIsProcessingClaim(true); // Indicate processing starts
    setCurrentLocalTxId(null); // Reset previous local ID

    try {
      const data = JSON.parse(decodedText) as QrCodeData;
      if (data.txid && data.sUPI && data.rUPI && typeof data.amt === 'number') {
        
        if (!user || !user.upiId) {
          toast({ variant: "destructive", title: "User Error", description: "Your UPI ID is missing. Please relogin before processing." });
          setIsProcessingClaim(false);
          return;
        }
        if (data.rUPI.toLowerCase() !== user.upiId.toLowerCase()) {
          toast({
            variant: "destructive",
            title: "Recipient Mismatch",
            description: `This QR code is for ${data.rUPI}, but you are logged in as ${user.upiId}.`,
          });
          setScanResultData(null); 
          setIsProcessingClaim(false);
          return;
        }
        setScanResultData(data); // Show scanned details BEFORE adding to pending, so UI can react

        const localId = addLocalPendingTransaction({ 
          otpOrTxId: data.txid, 
          amount: data.amt, 
          senderUpiId: data.sUPI,
          initialStatus: 'pending_qr_scan_confirmation'
        });
        
        if (localId) {
            setCurrentLocalTxId(localId); // Store for immediate claim button
            toast({ 
                title: "QR Scanned Successfully!", 
                description: `Transaction (TxID: ${data.txid}) details displayed. You can attempt to claim it now or find it in your Pending Wallet.`,
                duration: 7000
            });
        } else {
            toast({ variant: "destructive", title: "Local Record Error", description: "Failed to note this transaction locally." });
        }

      } else {
        throw new Error("Invalid QR code data structure.");
      }
    } catch (e) {
      console.error("QR Parse Error or Processing Error:", e);
      setScanError("Invalid QR code or error during processing. Please scan a valid CoinSend transaction QR.");
      toast({ variant: "destructive", title: "QR Error", description: "Could not read or process QR code data." });
    } finally {
        setIsProcessingClaim(false); 
    }
  }, [toast, user, addLocalPendingTransaction]);


  useEffect(() => {
    if (isScanningActive && selectedCameraId) {
      const qrRegionElement = document.getElementById(QR_REGION_ID);
      if (!qrRegionElement) {
        console.error(`useEffect: QR region element with ID '${QR_REGION_ID}' not found.`);
        setScanError(`QR scanner UI element not found. Please try refreshing the page.`);
        setIsScanningActive(false); 
        return;
      }

      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        html5QrCodeRef.current.stop().catch(err => console.error("Error stopping previous scanner instance:", err));
      }
      
      const localHtml5QrCode = new Html5Qrcode(QR_REGION_ID, {
          verbose: false,
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
      });
      html5QrCodeRef.current = localHtml5QrCode;

      const qrboxFunction = (viewfinderWidth: number, viewfinderHeight: number): QrDimensions => {
          const minEdgePercentage = 0.7;
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          const qrboxSize = Math.floor(minEdge * minEdgePercentage);
          return { width: qrboxSize, height: qrboxSize };
      };
      const config = { fps: 10, qrbox: qrboxFunction, aspectRatio: 1.0 };

      localHtml5QrCode.start(selectedCameraId, config, onScanSuccess, onScanFailureCallback)
        .catch((err) => {
          console.error("Error starting QR scanner:", err);
          setIsScanningActive(false);
          let message = "Failed to start QR scanner. ";
          if (err.name === "NotAllowedError") {
              message += "Camera permission denied. Please allow camera access.";
          } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
              message += "Selected camera not found or is unavailable.";
          } else if (err.name === "TrackStartError") {
              message += "Failed to start camera track. Another app might be using it."
          }
          else {
              message += err.message || "Unknown error.";
          }
          setScanError(message);
          toast({variant: "destructive", title: "Scanner Start Error", description: message});
        });
    }

    return () => { 
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        html5QrCodeRef.current.stop()
          .catch((err) => {
            console.error("Error stopping QR scanner during cleanup:", err);
          });
      }
    };
  }, [isScanningActive, selectedCameraId, onScanSuccess, onScanFailureCallback, toast]); 


  const initiateScanning = () => {
    if (!selectedCameraId) {
        setScanError("No camera selected or available.");
        toast({variant: "destructive", title: "Camera Error", description: "Please select a camera."});
        return;
    }
    setScanError(null);
    setScanResultData(null);
    setCurrentLocalTxId(null);
    setIsScanningActive(true); 
  };

  const haltScanning = () => {
    setIsScanningActive(false); 
  };

  const handleImmediateClaim = async () => {
    if (!currentLocalTxId) {
        toast({variant: "destructive", title: "Error", description: "No transaction selected for claim."});
        return;
    }
    if (!navigator.onLine) {
        toast({title:"Offline", description: "You are offline. Please connect to the internet to claim. This item is in your Pending Wallet."});
        return;
    }
    setIsProcessingClaim(true);
    await attemptClaimPendingTransaction(currentLocalTxId);
    // Toast messages and status updates are handled within attemptClaimPendingTransaction
    // We might want to clear scanResultData or update its display if claim is successful from here
    const finalTxState = localPendingTransactions.find(ltx => ltx.localId === currentLocalTxId);
    if (finalTxState?.status === 'confirmed_with_server') {
        // Optionally, could clear scanResultData or change its display
    }
    setIsProcessingClaim(false);
  }

  const currentTransactionState = currentLocalTxId ? localPendingTransactions.find(ltx => ltx.localId === currentLocalTxId) : null;


  return (
    <Card className="w-full max-w-lg mx-auto shadow-xl">
      <CardHeader>
        <CardTitle className="text-3xl font-headline flex items-center">
          <QrCode className="mr-2 h-8 w-8 text-primary" />
          Receive Coins via QR Scan
        </CardTitle>
        <CardDescription>
          Scan the QR code from the sender. Details will appear below.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {!isScanningActive && !scanResultData && (
          <>
            {cameras.length > 0 && (
              <div className="space-y-2">
                <label htmlFor="camera-select" className="text-sm font-medium">Select Camera:</label>
                <select 
                    id="camera-select" 
                    value={selectedCameraId || ''} 
                    onChange={(e) => setSelectedCameraId(e.target.value)}
                    className="w-full p-2 border border-input rounded-md bg-background text-foreground focus:ring-ring focus:ring-2"
                    aria-label="Select camera"
                >
                    {cameras.map(camera => (
                        <option key={camera.id} value={camera.id}>{camera.label || `Camera ${camera.id}`}</option>
                    ))}
                </select>
              </div>
            )}
            <Button onClick={initiateScanning} className="w-full" disabled={!selectedCameraId || cameras.length === 0 || isProcessingClaim}>
              <Camera className="mr-2 h-5 w-5" /> Start Scanning
            </Button>
          </>
        )}

        {isScanningActive && (
            <div className="space-y-2">
                <div id={QR_REGION_ID} className="w-full border-2 border-dashed border-primary rounded-lg aspect-square bg-muted flex items-center justify-center text-muted-foreground overflow-hidden">
                    <div className="flex flex-col items-center">
                        <ScanLine className="h-16 w-16 animate-pulse text-primary" />
                        <p className="mt-2">Initializing Camera...</p>
                    </div>
                </div>
                <Button onClick={haltScanning} variant="outline" className="w-full">
                    <XCircle className="mr-2 h-5 w-5" /> Stop Scanning
                </Button>
            </div>
        )}

        {scanError && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertTitle>Scan Error</AlertTitle>
            <AlertDescription>{scanError}</AlertDescription>
          </Alert>
        )}

        {scanResultData && !isScanningActive && (
          <Alert 
            variant={
                currentTransactionState?.status === 'confirmed_with_server' ? 'default' : 
                currentTransactionState?.status === 'failed_attempt' ? 'destructive' : 
                'default'
            }
            className={
                currentTransactionState?.status === 'confirmed_with_server' ? "border-green-500 bg-green-50/50" :
                currentTransactionState?.status === 'failed_attempt' ? "" :
                "border-primary/50 bg-primary/10"
            }
          >
            {currentTransactionState?.status === 'confirmed_with_server' && <ShieldCheck className="h-4 w-4 text-green-600" />}
            {currentTransactionState?.status === 'pending_qr_scan_confirmation' && <CheckCircle2 className="h-4 w-4 text-primary" />}
            {currentTransactionState?.status === 'failed_attempt' && <AlertTriangle className="h-4 w-4" />} {/* Icon for failed_attempt */}


            <AlertTitle 
                className={
                    currentTransactionState?.status === 'confirmed_with_server' ? "text-green-700" :
                    currentTransactionState?.status === 'failed_attempt' ? "" : // Default destructive styling for title will apply
                    "text-primary-foreground"
                }
            >
              {currentTransactionState?.status === 'confirmed_with_server' ? 'Claimed & Credited!' : 
               currentTransactionState?.status === 'failed_attempt' ? `Claim Failed: ${currentTransactionState.lastAttemptMessage || 'Ready to retry.'}`:
               'QR Scanned! Ready to Claim.'
              }
            </AlertTitle>
            <AlertDescription 
                className={
                    currentTransactionState?.status === 'confirmed_with_server' ? "text-green-700 space-y-1" :
                    currentTransactionState?.status === 'failed_attempt' ? "space-y-1" :
                    "text-primary-foreground/90 space-y-1"
                }
            >
              <p><strong>Transaction ID:</strong> {scanResultData.txid}</p>
              <p><strong>Amount:</strong> {scanResultData.amt.toFixed(2)} COINS</p>
              <p><strong>From:</strong> {scanResultData.sUPI}</p>
              {currentTransactionState?.status === 'pending_qr_scan_confirmation' && 
                <p className="font-semibold">You can attempt to claim these coins now if online.</p>
              }
              {currentTransactionState?.status === 'failed_attempt' && 
                <p className="font-semibold">You can retry claiming. If issues persist, check your Pending Wallet.</p>
              }
              {currentTransactionState?.status === 'confirmed_with_server' && 
                <p className="font-semibold">This amount has been added to your main coin wallet.</p>
              }
            </AlertDescription>
            <div className="mt-4 flex flex-col sm:flex-row gap-2">
              {(currentTransactionState?.status === 'pending_qr_scan_confirmation' || currentTransactionState?.status === 'failed_attempt') && (
                 <Button onClick={handleImmediateClaim} variant="default" className="w-full sm:flex-1" disabled={isProcessingClaim || !navigator.onLine || !currentLocalTxId}>
                    {isProcessingClaim && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {currentTransactionState?.status === 'failed_attempt' ? "Retry Claim" : "Verify &amp; Claim Now"}
                 </Button>
              )}
               <Button onClick={initiateScanning} variant="outline" className="w-full sm:flex-1" disabled={isProcessingClaim}>
                 <QrCode className="mr-2 h-4 w-4" /> Scan Another QR
              </Button>
            </div>
             {!navigator.onLine && (currentTransactionState?.status === 'pending_qr_scan_confirmation' || currentTransactionState?.status === 'failed_attempt') && (
                <p className="text-xs text-destructive text-center w-full pt-2">
                    Claiming requires an internet connection. This item is also in your Pending Wallet.
                </p>
            )}
          </Alert>
        )}
         {!isScanningActive && !scanResultData && cameras.length === 0 && !scanError &&(
            <Alert variant="destructive">
                <AlertTitle>No Cameras Found or Access Denied</AlertTitle>
                <AlertDescription>
                    Could not find any cameras on your device, or camera access was denied. Please ensure your browser has camera permissions and that a camera is available.
                </AlertDescription>
            </Alert>
        )}
      </CardContent>
       <CardFooter>
        <p className="text-xs text-muted-foreground text-center w-full">
            Claiming requires an internet connection. If offline, transactions will appear in your Pending Wallet for later processing.
        </p>
      </CardFooter>
    </Card>
  );
}

