// @flow
import * as React from 'react';
import ButtonBase from '@material-ui/core/ButtonBase';
import ResourcesLoader from '../../ResourcesLoader';
import GDevelopThemeContext from '../../UI/Theme/GDevelopThemeContext';
import { CorsAwareImage } from '../../UI/CorsAwareImage';
import Text from '../../UI/Text';
import { getDefaultResourceThumbnail } from '..';
import { getPixelatedImageRendering } from '../../Utils/CssHelpers';
import { isProjectImageResourceSmooth } from '../ResourcePreview/ImagePreview';
import Model3DPreview from '../ResourcePreview/Model3DPreview';
import CheckeredBackground from '../CheckeredBackground';

const paddingSize = 10;
const styles = {
  previewImage: {
    position: 'relative',
    objectFit: 'contain',
    verticalAlign: 'middle',
    pointerEvents: 'none',
  },
  previewImagePixelated: {
    imageRendering: getPixelatedImageRendering(),
  },
  cardContainer: {
    overflow: 'hidden',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    color: '#fff',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    backgroundColor: 'rgb(0,0,0,0.5)',
  },
  title: {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  icon: { width: 32, height: 32 },
  resourceSimpleImage: {
    zIndex: 1,
    width: 40,
    height: 40,
  },
};

type ImagePreviewProps = {|
  resource: gdResource,
  project: gdProject,
|};
const ImagePreview = ({ resource, project }: ImagePreviewProps) => {
  const resourceName = resource.getName();
  const resourceThumbnail = ResourcesLoader.getResourceFullUrl(
    project,
    resourceName,
    {}
  );
  const isImageResourceSmooth = isProjectImageResourceSmooth(
    project,
    resourceName
  );
  return (
    <>
      <CheckeredBackground />
      <CorsAwareImage
        key={resourceName}
        style={{
          ...styles.previewImage,
          maxWidth: 128 - 2 * paddingSize,
          maxHeight: 128 - 2 * paddingSize,
          ...(!isImageResourceSmooth
            ? styles.previewImagePixelated
            : undefined),
        }}
        src={resourceThumbnail}
        alt={resourceName}
      />
    </>
  );
};

type DefaultPreviewProps = {|
  resource: gdResource,
|};
const DefaultPreview = ({ resource }: DefaultPreviewProps) => {
  const resourceName = resource.getName();
  const resourceThumbnailSrc = getDefaultResourceThumbnail(resource);
  return (
    <CorsAwareImage
      title={resourceName}
      alt={resourceName}
      src={resourceThumbnailSrc}
      style={styles.resourceSimpleImage}
    />
  );
};

type Props = {|
  project: gdProject,
  resource: gdResource,
  size: number,
  onChoose: () => void,
  isSelected?: boolean,
|};

export const ProjectResourceCard = ({
  project,
  resource,
  onChoose,
  size,
  isSelected,
}: Props) => {
  const gdevelopTheme = React.useContext(GDevelopThemeContext);
  const resourceName = resource.getName();

  const renderResourcePreview = () => {
    switch (resource.getKind()) {
      case 'image':
        return <ImagePreview resource={resource} project={project} />;
      case 'model3D':
        return (
          <Model3DPreview
            modelUrl={ResourcesLoader.getResourceFullUrl(
              project,
              resourceName,
              {}
            )}
            fullWidth
          />
        );
      default:
        return <DefaultPreview resource={resource} />;
    }
  };

  return (
    <ButtonBase onClick={onChoose} focusRipple>
      <div
        style={{
          ...styles.cardContainer,
          width: size,
          height: size,
          outline: isSelected
            ? `1px solid ${gdevelopTheme.palette.secondary}`
            : undefined,
        }}
      >
        {renderResourcePreview()}
        <div style={styles.titleContainer}>
          <Text noMargin style={styles.title} color="inherit">
            {resourceName}
          </Text>
        </div>
      </div>
    </ButtonBase>
  );
};
