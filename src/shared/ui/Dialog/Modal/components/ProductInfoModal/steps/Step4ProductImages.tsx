import FileInput from '@/shared/ui/FileInput';
import Icon from '@/shared/ui/Icon';
import LabelInput from '@/shared/ui/LabelInput';
import UploadedImagePreview from '@/features/detail-page/components/UploadedImagePreview';
import type { Step4Props } from '../types';

const Step4ProductImages = ({
  productImagePreviews,
  isUploadingProduct,
  createUrlUpdateHandler,
  handleRemoveImage,
}: Step4Props) => {
  return (
    <div>
      <LabelInput title="상품 이미지를 올려주세요." isEssential>
        <FileInput
          id="productImageUrls"
          onChange={createUrlUpdateHandler('productImageUrls')}
          wrapClassName="w-full"
          className="form-create w-full text-gray-400"
          labelText="이미지 업로드"
          icon={<Icon name="image" className="text-gray-400" />}
          textClassName="p"
          multiple
        />
      </LabelInput>
      <UploadedImagePreview
        images={productImagePreviews}
        onRemove={handleRemoveImage('productImageUrls')}
        isUploading={isUploadingProduct}
      />
    </div>
  );
};

export default Step4ProductImages;
