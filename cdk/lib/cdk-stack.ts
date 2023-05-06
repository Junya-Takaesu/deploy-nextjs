import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
// import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { Duration } from 'aws-cdk-lib';
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';

export class CdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const defaultVpc = ec2.Vpc.fromLookup(this, 'defaultVpc', {
      vpcId: 'vpc-0cf52c2cff94b3083',
    });

    const ami = ec2.MachineImage.latestAmazonLinux2();

    const instanceType = ec2.InstanceType.of(
      ec2.InstanceClass.T2,
      ec2.InstanceSize.MICRO
    );

    const securityGroup = new ec2.SecurityGroup(this, 'securityGroup', {
      vpc: defaultVpc,
    });

    securityGroup.addIngressRule(
      ec2.Peer.ipv4('0.0.0.0/0'),
      ec2.Port.tcp(80),
      'Added by a CDK stack'
    );

    const userData = ec2.UserData.forLinux();
    userData.addCommands('sudo yum install git');

    const role = new iam.Role(this, 'roleForSSM', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
    });
    role.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore')
    );

    const launchTemplate = new ec2.LaunchTemplate(this, 'LaunchTemplate', {
      machineImage: ami,
      instanceType: instanceType,
      securityGroup: securityGroup,
      userData: userData,
      role: role,
    });

    const autoscalingGroup = new autoscaling.AutoScalingGroup(
      this,
      'autoscalingGroup',
      {
        vpc: defaultVpc,
        launchTemplate: launchTemplate,
      }
    );

    const alb = new elbv2.ApplicationLoadBalancer(
      this,
      'applicationLoadBalacner',
      {
        vpc: defaultVpc,
        internetFacing: true,
      }
    );

    const listener = alb.addListener('listner', {
      port: 80,
    });

    listener.addTargets('ApplicationFleet', {
      port: 80,
      targets: [autoscalingGroup],
      healthCheck: {
        path: '/',
        interval: Duration.minutes(1),
      },
    });

    autoscalingGroup.connections.allowFrom(alb, ec2.Port.tcp(80));
  }
}
